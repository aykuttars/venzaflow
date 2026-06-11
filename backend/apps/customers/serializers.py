from __future__ import annotations

import re
from datetime import date

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.customers.models import Customer, MedicalRecord
from apps.customers.validators import validate_foreign_kimlik_no, validate_tckn
from apps.customers.nvi_views import NviVerificationError, verify_patient_nvi

PHONE_CHARS = re.compile(r"^[+()\d\s\-]*$")
PHONE_MIN_DIGITS = 7
PHONE_MAX_DIGITS = 20

REQUIRED_ADDRESS_FIELDS = (
    "province_code",
    "province_name",
    "district_code",
    "district_name",
    "neighborhood_code",
    "neighborhood_name",
    "street_code",
    "street_name",
    "building_code",
    "building_no",
)


def _phone_digits(value: str) -> int:
    return len(re.findall(r"\d", value))


def validate_phone_value(value: str, *, required: bool = False) -> str:
    text = (value or "").strip()
    if not text:
        if required:
            raise serializers.ValidationError(_("Phone number is required."))
        return ""
    if not PHONE_CHARS.match(text):
        raise serializers.ValidationError(_("Enter a valid phone number."))
    digits = _phone_digits(text)
    if digits < PHONE_MIN_DIGITS or digits > PHONE_MAX_DIGITS:
        raise serializers.ValidationError(_("Enter a valid phone number (7–20 digits)."))
    return text


def validate_email_required(value: str) -> str:
    text = (value or "").strip()
    if not text:
        raise serializers.ValidationError(_("Email is required."))
    try:
        validate_email(text)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(str(exc.messages[0])) from exc
    return text


class PatientAddressSerializer(serializers.Serializer):
    province_code = serializers.IntegerField(required=False, allow_null=True)
    province_name = serializers.CharField(required=False, allow_blank=True)
    district_code = serializers.IntegerField(required=False, allow_null=True)
    district_name = serializers.CharField(required=False, allow_blank=True)
    neighborhood_code = serializers.IntegerField(required=False, allow_null=True)
    neighborhood_name = serializers.CharField(required=False, allow_blank=True)
    street_code = serializers.IntegerField(required=False, allow_null=True)
    street_name = serializers.CharField(required=False, allow_blank=True)
    building_code = serializers.IntegerField(required=False, allow_null=True)
    building_no = serializers.CharField(required=False, allow_blank=True)
    unit_code = serializers.IntegerField(required=False, allow_null=True)
    apartment_no = serializers.CharField(required=False, allow_blank=True)
    address_code = serializers.IntegerField(required=False, allow_null=True)
    full_address = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        required = getattr(self, "required_address", False)
        if not required:
            if not any(attrs.get(k) for k in attrs):
                return {}
            required = True
        missing = [k for k in REQUIRED_ADDRESS_FIELDS if not attrs.get(k)]
        if missing:
            raise serializers.ValidationError(
                _("Complete address selection is required (missing: %(fields)s)")
                % {"fields": ", ".join(missing)}
            )
        if not attrs.get("full_address"):
            attrs["full_address"] = self._compose(attrs)
        return attrs

    @staticmethod
    def _compose(attrs: dict) -> str:
        parts = [
            attrs.get("province_name"),
            attrs.get("district_name"),
            attrs.get("neighborhood_name"),
            attrs.get("street_name"),
            attrs.get("building_no"),
            attrs.get("apartment_no"),
        ]
        return " / ".join(p for p in parts if p)


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
        read_only_fields = ("kind",)

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

    def create(self, validated_data):
        validated_data["kind"] = Customer.Kind.CUSTOMER
        return super().create(validated_data)


class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    home_address = PatientAddressSerializer(required=False)
    work_address = PatientAddressSerializer(required=False, allow_null=True)
    has_photo = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = (
            "id",
            "first_name",
            "last_name",
            "full_name",
            "nationality",
            "tckn",
            "birth_date",
            "mobile_phone",
            "email",
            "home_phone",
            "work_phone",
            "home_address",
            "work_address",
            "nvi_verified",
            "nvi_verified_at",
            "has_photo",
            "phone",
        )
        read_only_fields = ("nvi_verified", "nvi_verified_at", "nvi_reference", "phone", "has_photo")

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip()

    def get_has_photo(self, obj) -> bool:
        return bool(obj.photo)

    def validate_mobile_phone(self, value):
        return validate_phone_value(value, required=True)

    def validate_email(self, value):
        return validate_email_required(value)

    def validate_home_phone(self, value):
        return validate_phone_value(value)

    def validate_work_phone(self, value):
        return validate_phone_value(value)

    def validate_birth_date(self, value):
        if not value:
            raise serializers.ValidationError(_("Birth date is required."))
        return value

    def validate(self, attrs):
        nationality = attrs.get(
            "nationality",
            getattr(self.instance, "nationality", "") if self.instance else "",
        )
        tckn = attrs.get("tckn", getattr(self.instance, "tckn", "") if self.instance else "")

        if nationality == Customer.Nationality.TC:
            try:
                attrs["tckn"] = validate_tckn(tckn)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"tckn": exc.messages[0]}) from exc
        elif nationality == Customer.Nationality.FOREIGN:
            try:
                attrs["tckn"] = validate_foreign_kimlik_no(tckn)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"tckn": exc.messages[0]}) from exc
        else:
            raise serializers.ValidationError({"nationality": _("Nationality is required.")})

        home = attrs.get("home_address")
        if home is None and self.instance:
            home = self.instance.home_address
        home_ser = PatientAddressSerializer(data=home or {}, required=True)
        home_ser.required_address = True
        home_ser.is_valid(raise_exception=True)
        attrs["home_address"] = home_ser.validated_data

        work = attrs.get("work_address")
        if work:
            work_ser = PatientAddressSerializer(data=work, required=False)
            work_ser.required_address = bool(
                any(work.get(k) for k in work if work.get(k) not in (None, ""))
            )
            work_ser.is_valid(raise_exception=True)
            attrs["work_address"] = work_ser.validated_data or {}
        elif self.instance and "work_address" not in attrs:
            attrs["work_address"] = self.instance.work_address or {}

        self._verify_patient_nvi(attrs)
        return attrs

    def _verify_patient_nvi(self, attrs: dict) -> None:
        try:
            verify_patient_nvi(instance=self.instance, attrs=attrs)
        except NviVerificationError as exc:
            raise serializers.ValidationError(
                {"nvi_step": exc.step, "detail": str(exc)}
            ) from exc

    def create(self, validated_data):
        validated_data.pop("nvi_reference", None)
        validated_data["kind"] = Customer.Kind.PATIENT
        validated_data.setdefault("phone", validated_data.get("mobile_phone", ""))
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("nvi_reference", None)
        if "mobile_phone" in validated_data:
            validated_data["phone"] = validated_data["mobile_phone"]
        return super().update(instance, validated_data)


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
