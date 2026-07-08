from __future__ import annotations

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission, IsPlatformAdmin
from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice
from apps.tariff.serializers import (
    ClinicPriceUpdateSerializer,
    DentalTariffDetailSerializer,
    DentalTariffSerializer,
    TenantTariffItemListSerializer,
)
from apps.tariff.services.tenant_prices import (
    ensure_tenant_tariff_prices,
    validate_clinic_prices_not_below_reference,
)
from apps.tariff.services.vat import sync_vat_pair
from apps.tariff.services.validation import get_active_tariff, list_procedure_violations
from rest_framework import viewsets
from rest_framework.decorators import action


class PlatformDentalTariffViewSet(viewsets.ReadOnlyModelViewSet):
    """Platform admin: list imported tariffs and activate a year."""

    permission_classes = [IsPlatformAdmin]
    queryset = DentalTariff.objects.all().order_by("-year")
    serializer_class = DentalTariffSerializer

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DentalTariffDetailSerializer
        return DentalTariffSerializer

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def activate(self, request, pk=None):
        from apps.tariff.services.tenant_year_sync import sync_active_tariff_to_all_tenants

        tariff = self.get_object()
        DentalTariff.objects.exclude(pk=tariff.pk).update(is_active=False)
        tariff.is_active = True
        tariff.save(update_fields=["is_active", "updated_at"])
        sync_stats = sync_active_tariff_to_all_tenants(tariff=tariff)
        data = DentalTariffSerializer(tariff).data
        data["sync"] = sync_stats
        return Response(data)


class ActiveTariffView(APIView):
    """Tenant read-only: active tariff summary."""

    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"
    required_permission = "oral.read"

    def get(self, request):
        tariff = get_active_tariff()
        if not tariff:
            return Response({"configured": False, "tariff": None, "sections": []})
        sections = (
            tariff.items.order_by("section_no")
            .values("section_no", "section_name")
            .distinct()
        )
        seen: set[int] = set()
        section_list = []
        for row in sections:
            no = row["section_no"]
            if no in seen:
                continue
            seen.add(no)
            section_list.append({"section_no": no, "section_name": row["section_name"]})
        return Response(
            {
                "configured": True,
                "tariff": DentalTariffSerializer(tariff).data,
                "sections": section_list,
            }
        )


class TariffItemListView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"
    required_permission = "oral.read"

    def get(self, request):
        tariff = get_active_tariff()
        if not tariff:
            return Response({"count": 0, "results": [], "page": 1, "page_size": 50})

        ensure_tenant_tariff_prices(request.user.tenant_id, tariff=tariff)

        q = (request.query_params.get("q") or "").strip()
        section = request.query_params.get("section")
        try:
            page = max(1, int(request.query_params.get("page", "1")))
        except ValueError:
            page = 1
        try:
            page_size = min(200, max(1, int(request.query_params.get("page_size", "50"))))
        except ValueError:
            page_size = 50

        qs = tariff.items.all()
        if section:
            qs = qs.filter(section_no=int(section))
        if q:
            if q.replace("-", "").isdigit() and "-" in q:
                qs = qs.filter(code__iexact=q)
            else:
                qs = qs.filter(name__icontains=q)
        qs = qs.order_by("section_no", "code")
        total = qs.count()
        offset = (page - 1) * page_size
        page_qs = qs[offset : offset + page_size]
        serializer = TenantTariffItemListSerializer(
            page_qs, many=True, context={"request": request}
        )
        return Response(
            {
                "count": total,
                "page": page,
                "page_size": page_size,
                "results": serializer.data,
            }
        )


class TariffItemClinicPriceView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"

    def initial(self, request, *args, **kwargs):
        self.required_permission = "oral.write" if request.method == "PATCH" else "oral.read"
        super().initial(request, *args, **kwargs)

    @transaction.atomic
    def patch(self, request, item_id):
        tariff = get_active_tariff()
        if not tariff:
            return Response({"detail": "No active tariff."}, status=status.HTTP_404_NOT_FOUND)
        try:
            item = tariff.items.get(pk=item_id)
        except DentalTariffItem.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        ser = ClinicPriceUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        changed = ser.validated_data["changed"]
        excl = ser.validated_data["clinic_price_excl_vat"]
        incl = ser.validated_data["clinic_price_incl_vat"]
        excl, incl = sync_vat_pair(changed=changed, excl=excl, incl=incl)
        validate_clinic_prices_not_below_reference(item, excl, incl)

        row, _ = TenantTariffItemPrice.objects.update_or_create(
            tenant_id=request.user.tenant_id,
            tariff_item=item,
            defaults={
                "clinic_price_excl_vat": excl,
                "clinic_price_incl_vat": incl,
            },
        )

        from apps.oral.services.tariff_procedure_sync import sync_tdb_procedures_for_tenant

        sync_tdb_procedures_for_tenant(request.user.tenant_id)

        list_ser = TenantTariffItemListSerializer(item, context={"request": request})
        return Response(list_ser.data)


class TariffSyncProceduresView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"
    required_permission = "oral.write"

    def post(self, request):
        from apps.oral.services.tariff_procedure_sync import sync_tdb_procedures_for_tenant

        ensure_tenant_tariff_prices(request.user.tenant_id)
        stats = sync_tdb_procedures_for_tenant(request.user.tenant_id)
        return Response(stats)


class TariffViolationsView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"
    required_permission = "oral.read"

    def get(self, request):
        violations = list_procedure_violations(request.user.tenant_id)
        tariff = get_active_tariff()
        return Response(
            {
                "tariff_year": tariff.year if tariff else None,
                "count": len(violations),
                "violations": violations,
            }
        )
