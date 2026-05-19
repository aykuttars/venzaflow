from __future__ import annotations

from django.db import models

from apps.tenants.models import TenantOwnedModel


class Customer(TenantOwnedModel):
    class Kind(models.TextChoices):
        CUSTOMER = "customer", "Customer"
        PATIENT = "patient", "Patient"

    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.CUSTOMER)
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)

    class Meta:
        db_table = "customer"
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["tenant", "last_name"]),
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
