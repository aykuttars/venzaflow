from __future__ import annotations

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import serializers

from apps.customers.models import Customer, MedicalRecord

PHONE_CHARS = re.compile(r"^[+()\d\s\-]*$")
PHONE_MIN_DIGITS = 7
PHONE_MAX_DIGITS = 20


def _phone_digits(value: str) -> int:
    return len(re.findall(r"\d", value))


def validate_phone_value(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return ""
    if not PHONE_CHARS.match(text):
        raise serializers.ValidationError("Enter a valid phone number.")
    digits = _phone_digits(text)
    if digits < PHONE_MIN_DIGITS or digits > PHONE_MAX_DIGITS:
        raise serializers.ValidationError("Enter a valid phone number (7–20 digits).")
    return text


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

    def validate_phone(self, value):
        return validate_phone_value(value)

    def validate_email(self, value):
        text = (value or "").strip()
        if not text:
            return ""
        try:
            validate_email(text)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(str(exc.messages[0])) from exc
        return text


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
