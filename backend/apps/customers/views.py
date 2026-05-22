from __future__ import annotations

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from apps.common.viewsets import TenantScopedViewSet
from apps.customers.models import Customer, MedicalRecord
from apps.customers.patient_photo import process_patient_photo
from apps.customers.serializers import (
    CustomerSerializer,
    MedicalRecordSerializer,
    PatientSerializer,
)


class CustomerViewSet(TenantScopedViewSet):
    queryset = Customer.objects.filter(kind=Customer.Kind.CUSTOMER)
    serializer_class = CustomerSerializer
    required_module = "customers"
    action_permission_map = {
        "list": "customers.read",
        "retrieve": "customers.read",
        "create": "customers.write",
        "update": "customers.write",
        "partial_update": "customers.write",
        "destroy": "customers.write",
    }
    search_fields = ("first_name", "last_name", "email", "phone")
    ordering_fields = ("last_name", "first_name")


class PatientViewSet(TenantScopedViewSet):
    queryset = Customer.objects.filter(kind=Customer.Kind.PATIENT)
    serializer_class = PatientSerializer
    required_module = "patients"
    action_permission_map = {
        "list": "patients.read",
        "retrieve": "patients.read",
        "create": "patients.write",
        "update": "patients.write",
        "partial_update": "patients.write",
        "destroy": "patients.write",
    }
    search_fields = ("first_name", "last_name", "email", "phone", "tckn", "mobile_phone")
    ordering_fields = ("last_name", "first_name")

    def initial(self, request, *args, **kwargs):
        if self.action == "photo":
            self.required_permission = (
                "patients.write" if request.method in ("POST", "DELETE") else "patients.read"
            )
        super().initial(request, *args, **kwargs)

    @action(
        detail=True,
        methods=["get", "post", "delete"],
        url_path="photo",
        parser_classes=[MultiPartParser, FormParser],
    )
    def photo(self, request, pk=None):
        patient = self.get_object()
        if request.method == "GET":
            if not patient.photo:
                return Response(status=status.HTTP_404_NOT_FOUND)
            response = FileResponse(patient.photo.open("rb"), content_type="image/jpeg")
            response["Cache-Control"] = "private, max-age=3600"
            return response

        if request.method == "DELETE":
            if patient.photo:
                patient.photo.delete(save=True)
            return Response(status=status.HTTP_204_NO_CONTENT)

        uploaded = request.FILES.get("photo")
        if not uploaded:
            return Response(
                {"detail": "Photo file is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            processed = process_patient_photo(uploaded)
        except DjangoValidationError as exc:
            message = exc.messages[0] if exc.messages else str(exc)
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)

        if patient.photo:
            patient.photo.delete(save=False)
        patient.photo.save(f"{patient.pk}.jpg", processed, save=True)
        return Response({"has_photo": True}, status=status.HTTP_200_OK)


class MedicalRecordViewSet(TenantScopedViewSet):
    queryset = MedicalRecord.objects.select_related("patient", "tenant")
    serializer_class = MedicalRecordSerializer
    required_module = "patients"
    action_permission_map = {
        "list": "patients.read",
        "retrieve": "patients.read",
        "create": "patients.write",
        "update": "patients.write",
        "partial_update": "patients.write",
        "destroy": "patients.write",
    }
    filterset_fields = ("patient",)
    search_fields = ("summary",)
    ordering_fields = ("updated_at",)
