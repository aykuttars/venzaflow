from __future__ import annotations

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.common.viewsets import TenantScopedViewSet
from apps.customers.models import Customer
from apps.oral.chart_sync import sync_chart_from_treatment
from apps.oral.models import OralTreatment, PatientOralChart, ProcedureCatalog
from apps.oral.seed_data import reseed_oral_procedures
from apps.oral.serializers import (
    OralTreatmentBulkCreateSerializer,
    OralTreatmentSerializer,
    PatientOralChartSerializer,
    ProcedureCatalogSerializer,
)


class ProcedureCatalogViewSet(TenantScopedViewSet):
    queryset = ProcedureCatalog.objects.filter(is_active=True)
    serializer_class = ProcedureCatalogSerializer
    required_module = "oral"
    action_permission_map = {
        "list": "oral.read",
        "retrieve": "oral.read",
        "create": "oral.write",
        "update": "oral.write",
        "partial_update": "oral.write",
        "destroy": "oral.write",
        "reseed": "oral.write",
    }
    search_fields = ("name", "code")
    ordering_fields = ("sort_order", "name", "default_price")
    filterset_fields = ("category", "is_frequent", "is_active")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ("update", "partial_update", "destroy", "retrieve"):
            return ProcedureCatalog.all_tenants.filter(tenant_id=self.request.user.tenant_id)
        show_inactive = self.request.query_params.get("include_inactive") == "1"
        if show_inactive and self.action == "list":
            return ProcedureCatalog.all_tenants.filter(tenant_id=self.request.user.tenant_id)
        return qs

    @action(detail=False, methods=["post"], url_path="reseed")
    def reseed(self, request):
        sync_names = request.query_params.get("sync_names") == "1"
        stats = reseed_oral_procedures(request.user.tenant, sync_names=sync_names)
        return Response(stats)


class PatientOralChartView(APIView):
    permission_classes = [IsAuthenticated, HasModule, HasViewPermission]
    required_module = "oral"

    def initial(self, request, *args, **kwargs):
        self.required_permission = "oral.write" if request.method in ("PUT", "PATCH") else "oral.read"
        super().initial(request, *args, **kwargs)

    def _get_patient(self, request, patient_id):
        from django.shortcuts import get_object_or_404

        return get_object_or_404(
            Customer.objects.filter(kind=Customer.Kind.PATIENT, tenant_id=request.user.tenant_id),
            pk=patient_id,
        )

    def get(self, request, patient_id):
        patient = self._get_patient(request, patient_id)
        chart, _ = PatientOralChart.objects.get_or_create(
            tenant_id=request.user.tenant_id,
            patient=patient,
            defaults={"teeth_state": {}},
        )
        return Response(PatientOralChartSerializer(chart).data)

    def patch(self, request, patient_id):
        patient = self._get_patient(request, patient_id)
        chart, _ = PatientOralChart.objects.get_or_create(
            tenant_id=request.user.tenant_id,
            patient=patient,
            defaults={"teeth_state": {}},
        )
        ser = PatientOralChartSerializer(chart, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class OralTreatmentViewSet(TenantScopedViewSet):
    queryset = OralTreatment.objects.select_related("procedure", "patient", "doctor")
    serializer_class = OralTreatmentSerializer
    required_module = "oral"
    action_permission_map = {
        "list": "oral.read",
        "retrieve": "oral.read",
        "create": "oral.write",
        "update": "oral.write",
        "partial_update": "oral.write",
        "destroy": "oral.write",
        "bulk": "oral.write",
    }
    filterset_fields = ("patient", "status", "session_date", "procedure")
    ordering_fields = ("session_date", "created_at", "unit_price")

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get("unbilled") == "1":
            qs = qs.filter(invoice__isnull=True)
        return qs

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk(self, request):
        ser = OralTreatmentBulkCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        created = ser.save()
        for t in created:
            if t.status == OralTreatment.Status.COMPLETED:
                sync_chart_from_treatment(t)
        return Response(
            OralTreatmentSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_create(self, serializer):
        obj = serializer.save(tenant_id=self.request.user.tenant_id)
        if obj.status == OralTreatment.Status.COMPLETED:
            sync_chart_from_treatment(obj)

    def perform_update(self, serializer):
        obj = serializer.save()
        if obj.status == OralTreatment.Status.COMPLETED:
            sync_chart_from_treatment(obj)
