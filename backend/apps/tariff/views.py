from __future__ import annotations

from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import SearchFilter
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission, IsPlatformAdmin
from apps.tariff.models import DentalTariff, DentalTariffItem
from apps.tariff.serializers import (
    DentalTariffDetailSerializer,
    DentalTariffItemSerializer,
    DentalTariffSerializer,
)
from apps.tariff.services.validation import get_active_tariff, list_procedure_violations


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
        tariff = self.get_object()
        DentalTariff.objects.exclude(pk=tariff.pk).update(is_active=False)
        tariff.is_active = True
        tariff.save(update_fields=["is_active", "updated_at"])
        return Response(DentalTariffSerializer(tariff).data)


class ActiveTariffView(APIView):
    """Tenant read-only: active tariff summary."""

    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"
    required_permission = "oral.read"

    def get(self, request):
        tariff = get_active_tariff()
        if not tariff:
            return Response({"configured": False, "tariff": None})
        return Response(
            {
                "configured": True,
                "tariff": DentalTariffSerializer(tariff).data,
            }
        )


class TariffItemSearchView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "oral"
    required_permission = "oral.read"

    def get(self, request):
        tariff = get_active_tariff()
        if not tariff:
            return Response({"results": [], "count": 0})
        q = (request.query_params.get("q") or "").strip()
        section = request.query_params.get("section")
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
        results = qs[:50]
        return Response(
            {
                "count": total,
                "results": DentalTariffItemSerializer(results, many=True).data,
            }
        )


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
