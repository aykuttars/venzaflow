from __future__ import annotations

from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.customers.models import Customer
from apps.oral.models import OralTreatment, PatientOralChart, ProcedureCatalog
from apps.oral.services.procedure_product import ensure_procedure_product
from apps.oral.validators import validate_fdi_tooth_numbers


class ProcedureCatalogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True, default="")

    class Meta:
        model = ProcedureCatalog
        fields = (
            "id",
            "code",
            "name",
            "category",
            "default_price",
            "product",
            "product_name",
            "is_active",
            "sort_order",
            "is_frequent",
            "default_tooth_condition",
        )
        read_only_fields = ("id", "product_name")

    def validate_default_price(self, value):
        if value < Decimal("0"):
            raise serializers.ValidationError("Price must be zero or greater.")
        return value

    def create(self, validated_data):
        obj = super().create(validated_data)
        ensure_procedure_product(obj)
        return obj

    def update(self, instance, validated_data):
        obj = super().update(instance, validated_data)
        ensure_procedure_product(obj)
        return obj


class PatientOralChartSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = PatientOralChart
        fields = ("id", "patient", "patient_name", "jaw_type", "teeth_state")
        read_only_fields = ("id", "patient_name")

    def get_patient_name(self, obj):
        p = obj.patient
        return f"{p.first_name} {p.last_name}".strip()


class OralTreatmentSerializer(serializers.ModelSerializer):
    procedure_name = serializers.CharField(source="procedure.name", read_only=True)
    doctor_name = serializers.SerializerMethodField()

    class Meta:
        model = OralTreatment
        fields = (
            "id",
            "patient",
            "procedure",
            "procedure_name",
            "tooth_numbers",
            "surfaces",
            "status",
            "phase",
            "unit_price",
            "planned_at",
            "performed_at",
            "session_date",
            "doctor",
            "doctor_name",
            "notes",
            "invoice",
            "invoiced_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "created_at",
            "updated_at",
            "procedure_name",
            "doctor_name",
            "invoice",
            "invoiced_at",
        )

    def get_doctor_name(self, obj):
        if not obj.doctor_id:
            return ""
        d = obj.doctor
        return f"{getattr(d, 'first_name', '')} {getattr(d, 'last_name', '')}".strip() or d.email

    def validate_patient(self, patient):
        if patient.kind != Customer.Kind.PATIENT:
            raise serializers.ValidationError("Patient must have kind=patient.")
        return patient

    def validate_tooth_numbers(self, value):
        return validate_fdi_tooth_numbers(value)

    def validate(self, attrs):
        procedure = attrs.get("procedure") or getattr(self.instance, "procedure", None)
        if procedure and "unit_price" not in attrs and self.instance is None:
            price = procedure.default_price
            if procedure.product_id:
                price = procedure.product.unit_price
            attrs["unit_price"] = price
        if procedure and "phase" not in attrs:
            attrs["phase"] = procedure.category
        if "session_date" not in attrs and self.instance is None:
            attrs["session_date"] = timezone.localdate()
        return attrs


class OralTreatmentBulkCreateSerializer(serializers.Serializer):
    patient = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.none())
    procedure = serializers.PrimaryKeyRelatedField(queryset=ProcedureCatalog.objects.none())
    tooth_numbers = serializers.ListField(child=serializers.IntegerField(), min_length=1)
    status = serializers.ChoiceField(
        choices=OralTreatment.Status.choices,
        default=OralTreatment.Status.PLANNED,
        required=False,
    )
    session_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True, default="")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request and request.user.tenant_id:
            tid = request.user.tenant_id
            self.fields["patient"].queryset = Customer.objects.filter(
                tenant_id=tid, kind=Customer.Kind.PATIENT
            )
            self.fields["procedure"].queryset = ProcedureCatalog.objects.filter(tenant_id=tid)

    def validate_tooth_numbers(self, value):
        return validate_fdi_tooth_numbers(value)

    def create(self, validated_data):
        tenant_id = self.context["request"].user.tenant_id
        procedure = validated_data["procedure"]
        patient = validated_data["patient"]
        tooth_numbers = validated_data["tooth_numbers"]
        status = validated_data.get("status", OralTreatment.Status.PLANNED)
        session_date = validated_data.get("session_date") or timezone.localdate()
        notes = validated_data.get("notes", "")

        price = procedure.default_price
        if procedure.product_id:
            price = procedure.product.unit_price

        created = []
        for tooth in tooth_numbers:
            t = OralTreatment.objects.create(
                tenant_id=tenant_id,
                patient=patient,
                procedure=procedure,
                tooth_numbers=[tooth],
                status=status,
                phase=procedure.category,
                unit_price=price,
                session_date=session_date,
                notes=notes,
            )
            created.append(t)
        return created
