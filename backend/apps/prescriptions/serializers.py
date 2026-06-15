from __future__ import annotations

from django.db import transaction
from rest_framework import serializers

from apps.prescriptions.models import DrugCatalog, Prescription, PrescriptionLine
from apps.prescriptions.services.prescription import finalize_prescription


class DrugCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrugCatalog
        fields = (
            "id",
            "barkod",
            "name",
            "form",
            "strength",
            "unit",
            "is_active",
        )
        read_only_fields = ("id",)


class PrescriptionLineSerializer(serializers.ModelSerializer):
    drug_label = serializers.SerializerMethodField()

    class Meta:
        model = PrescriptionLine
        fields = (
            "id",
            "drug",
            "drug_barkod",
            "drug_name",
            "drug_label",
            "box_count",
            "quantity_per_box",
            "dose",
            "frequency",
            "period_days",
            "route",
            "usage_instruction",
            "sort_order",
        )
        read_only_fields = ("id", "drug_label")

    def get_drug_label(self, obj):
        if obj.drug_id:
            return f"{obj.drug.barkod} — {obj.drug.name}"
        return obj.drug_name


class PrescriptionSerializer(serializers.ModelSerializer):
    lines = PrescriptionLineSerializer(many=True, required=False)
    patient_name = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    line_count = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = (
            "id",
            "prescription_no",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "oral_treatment",
            "diagnosis_code",
            "diagnosis_text",
            "prescription_type",
            "provision_type",
            "status",
            "medula_reference",
            "notes",
            "finalized_at",
            "submitted_at",
            "line_count",
            "lines",
        )
        read_only_fields = (
            "id",
            "prescription_no",
            "status",
            "medula_reference",
            "finalized_at",
            "submitted_at",
            "patient_name",
            "doctor_name",
            "line_count",
        )

    def get_patient_name(self, obj):
        p = obj.patient
        return f"{p.first_name} {p.last_name}".strip()

    def get_doctor_name(self, obj):
        d = obj.doctor
        if not d:
            return ""
        name = f"{getattr(d, 'first_name', '')} {getattr(d, 'last_name', '')}".strip()
        return name or d.email

    def get_line_count(self, obj):
        return obj.lines.count()

    def validate_patient(self, value):
        from apps.customers.models import Customer

        if value.kind != Customer.Kind.PATIENT:
            raise serializers.ValidationError("Must be a patient.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        lines_data = validated_data.pop("lines", [])
        tenant_id = validated_data.pop("tenant_id", self.context["request"].user.tenant_id)
        user = self.context["request"].user
        if not validated_data.get("doctor"):
            validated_data["doctor"] = user
        prescription = Prescription.objects.create(tenant_id=tenant_id, **validated_data)
        self._sync_lines(prescription, lines_data, tenant_id)
        return prescription

    @transaction.atomic
    def update(self, instance, validated_data):
        if instance.status != Prescription.Status.DRAFT:
            raise serializers.ValidationError("Only draft prescriptions can be edited.")
        lines_data = validated_data.pop("lines", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if lines_data is not None:
            instance.lines.all().delete()
            self._sync_lines(instance, lines_data, instance.tenant_id)
        return instance

    def _sync_lines(self, prescription, lines_data, tenant_id):
        for i, line in enumerate(lines_data):
            drug = line.get("drug")
            drug_barkod = line.get("drug_barkod") or (drug.barkod if drug else "")
            drug_name = line.get("drug_name") or (drug.name if drug else "")
            PrescriptionLine.objects.create(
                tenant_id=tenant_id,
                prescription=prescription,
                drug=drug,
                drug_barkod=drug_barkod,
                drug_name=drug_name,
                box_count=line.get("box_count", 1),
                quantity_per_box=line.get("quantity_per_box", 1),
                dose=line.get("dose", ""),
                frequency=line.get("frequency", ""),
                period_days=line.get("period_days", 7),
                route=line.get("route", PrescriptionLine.Route.ORAL),
                usage_instruction=line.get("usage_instruction", ""),
                sort_order=line.get("sort_order", i),
            )
