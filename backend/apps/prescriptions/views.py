from __future__ import annotations

from django.db.models import Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.customers.models import Customer
from apps.prescriptions.models import DrugCatalog, Prescription
from apps.prescriptions.serializers import DrugCatalogSerializer, PrescriptionSerializer
from apps.prescriptions.services.prescription import cancel_prescription, finalize_prescription
from apps.prescriptions.services.preview import render_prescription_preview_html


class DrugCatalogViewSet(TenantScopedViewSet):
    queryset = DrugCatalog.objects.filter(is_active=True)
    serializer_class = DrugCatalogSerializer
    required_module = "patients"
    action_permission_map = {
        "list": "prescriptions.read",
        "retrieve": "prescriptions.read",
        "create": "prescriptions.write",
        "update": "prescriptions.write",
        "partial_update": "prescriptions.write",
        "destroy": "prescriptions.write",
    }
    search_fields = ("name", "barkod")
    ordering_fields = ("name", "barkod")
    filterset_fields = ("is_active",)

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action in ("update", "partial_update", "destroy", "retrieve"):
            return DrugCatalog.all_tenants.filter(tenant_id=self.request.user.tenant_id)
        search = (self.request.query_params.get("search") or "").strip()
        if len(search) >= 3:
            qs = qs.filter(Q(name__icontains=search) | Q(barkod__icontains=search))
        elif search:
            return qs.none()
        return qs


class PrescriptionViewSet(TenantScopedViewSet):
    queryset = Prescription.objects.prefetch_related("lines__drug").select_related(
        "patient", "doctor", "tenant"
    )
    serializer_class = PrescriptionSerializer
    required_module = "patients"
    action_permission_map = {
        "list": "prescriptions.read",
        "retrieve": "prescriptions.read",
        "create": "prescriptions.write",
        "update": "prescriptions.write",
        "partial_update": "prescriptions.write",
        "destroy": "prescriptions.write",
        "finalize": "prescriptions.write",
        "cancel": "prescriptions.write",
        "preview": "prescriptions.read",
    }
    filterset_fields = ("patient", "status", "prescription_type")
    ordering_fields = ("id", "finalized_at", "prescription_no")

    def get_queryset(self):
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.user.tenant_id)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj.status != Prescription.Status.DRAFT:
            return Response(
                {"detail": "Only draft prescriptions can be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="finalize")
    def finalize(self, request, pk=None):
        prescription = self.get_object()
        finalize_prescription(prescription, actor=request.user)
        return Response(PrescriptionSerializer(prescription).data)

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        prescription = self.get_object()
        cancel_prescription(prescription)
        return Response(PrescriptionSerializer(prescription).data)

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        prescription = self.get_object()
        html = render_prescription_preview_html(prescription)
        return HttpResponse(html, content_type="text/html; charset=utf-8")
