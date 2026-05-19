from rest_framework import serializers

from apps.customers.models import Customer, MedicalRecord


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = (
            "id",
            "kind",
            "first_name",
            "last_name",
            "phone",
            "email",
        )


class MedicalRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalRecord
        fields = ("id", "patient", "summary", "created_at", "updated_at")
        read_only_fields = ("created_at", "updated_at")
