from rest_framework import serializers

from apps.customers.models import Customer, MedicalRecord


class CustomerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            "id",
            "kind",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "email",
        )

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()


class MedicalRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalRecord
        fields = (
            "id",
            "patient",
            "patient_name",
            "summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_patient_name(self, obj):
        p = obj.patient
        return f"{p.first_name} {p.last_name}".strip()
