from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.tenants.models import TenantOwnedModel


class ProcedureCatalog(TenantOwnedModel):
    class Category(models.TextChoices):
        DIAGNOSIS = "diagnosis", "Diagnosis"
        PLANNING = "planning", "Planning"
        TREATMENT = "treatment", "Treatment"

    code = models.CharField(max_length=32, blank=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=16, choices=Category.choices, default=Category.TREATMENT)
    default_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    product = models.ForeignKey(
        "products.Product",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="oral_procedures",
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_frequent = models.BooleanField(default=False)
    default_tooth_condition = models.CharField(max_length=32, blank=True)
    tariff_item = models.ForeignKey(
        "tariff.DentalTariffItem",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procedures",
    )

    class Meta:
        db_table = "oral_procedure_catalog"
        ordering = ["sort_order", "name"]
        indexes = [
            models.Index(fields=["tenant", "category", "is_active"]),
        ]

    def __str__(self) -> str:
        return self.name


class PatientOralChart(TenantOwnedModel):
    class JawType(models.TextChoices):
        PERMANENT = "permanent", "Permanent"
        PRIMARY = "primary", "Primary"
        MIXED = "mixed", "Mixed"

    patient = models.OneToOneField(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="oral_chart",
    )
    jaw_type = models.CharField(max_length=16, choices=JawType.choices, default=JawType.PERMANENT)
    teeth_state = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "patient_oral_chart"

    def __str__(self) -> str:
        return f"Chart for patient {self.patient_id}"


class OralTreatment(TenantOwnedModel):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    patient = models.ForeignKey(
        "customers.Customer",
        on_delete=models.CASCADE,
        related_name="oral_treatments",
    )
    procedure = models.ForeignKey(
        ProcedureCatalog,
        on_delete=models.PROTECT,
        related_name="treatments",
    )
    tooth_numbers = models.JSONField(default=list)
    surfaces = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PLANNED)
    phase = models.CharField(max_length=16, blank=True)
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    planned_at = models.DateField(null=True, blank=True)
    performed_at = models.DateField(null=True, blank=True)
    session_date = models.DateField(null=True, blank=True)
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="oral_treatments_performed",
    )
    notes = models.TextField(blank=True)
    invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="oral_treatments",
    )
    invoiced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "oral_treatment"
        ordering = ["-session_date", "-created_at"]
        indexes = [
            models.Index(fields=["tenant", "patient", "status"]),
            models.Index(fields=["tenant", "session_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.procedure.name} ({self.status})"
