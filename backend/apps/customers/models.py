from __future__ import annotations

from django.db import models

from apps.customers.patient_photo import patient_photo_upload_to
from apps.tenants.models import TenantOwnedModel


class TurkishProvince(models.Model):
    plate_code = models.PositiveSmallIntegerField(primary_key=True)
    name = models.CharField(max_length=64)

    class Meta:
        db_table = "turkish_province"
        ordering = ["name"]
        verbose_name = "Turkish province"
        verbose_name_plural = "Turkish provinces"

    def __str__(self) -> str:
        return f"{self.plate_code:02d} {self.name}"


class Customer(TenantOwnedModel):
    class Kind(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        PATIENT = "patient", "Patient"

    class Nationality(models.TextChoices):
        TC = "tc", "Turkish citizen"
        FOREIGN = "foreign", "Foreign national"

    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.CUSTOMER)
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)

    nationality = models.CharField(
        max_length=16,
        choices=Nationality.choices,
        blank=True,
    )
    tckn = models.CharField(max_length=11, blank=True, db_index=True)
    birth_date = models.DateField(null=True, blank=True)
    mobile_phone = models.CharField(max_length=32, blank=True)
    home_phone = models.CharField(max_length=32, blank=True)
    work_phone = models.CharField(max_length=32, blank=True)
    home_address = models.JSONField(default=dict, blank=True)
    work_address = models.JSONField(default=dict, blank=True)
    nvi_verified = models.BooleanField(default=False)
    nvi_verified_at = models.DateTimeField(null=True, blank=True)
    nvi_reference = models.CharField(max_length=128, blank=True)
    photo = models.ImageField(
        upload_to=patient_photo_upload_to,
        blank=True,
        null=True,
        max_length=512,
    )

    class Meta:
        db_table = "customer"
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["tenant", "last_name"]),
            models.Index(fields=["tenant", "tckn"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "tckn"],
                condition=models.Q(tckn__gt=""),
                name="u_customer_tenant_tckn",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class MedicalRecord(TenantOwnedModel):
    patient = models.ForeignKey(
        Customer,
        on_delete=models.CASCADE,
        related_name="medical_records",
    )
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "medical_record"
        ordering = ["-updated_at"]
