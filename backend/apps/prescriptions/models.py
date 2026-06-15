from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.customers.models import Customer
from apps.tenants.models import TenantOwnedModel


class DrugCatalog(TenantOwnedModel):
    barkod = models.CharField(max_length=32, db_index=True)
    name = models.CharField(max_length=255)
    form = models.CharField(max_length=64, blank=True)
    strength = models.CharField(max_length=64, blank=True)
    unit = models.CharField(max_length=32, blank=True, default="adet")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "drug_catalog"
        unique_together = [("tenant", "barkod")]
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.barkod} — {self.name}"


class Prescription(TenantOwnedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        READY = "ready", "Ready"
        SUBMITTED = "submitted", "Submitted"
        CANCELLED = "cancelled", "Cancelled"

    class PrescriptionType(models.TextChoices):
        NORMAL = "normal", "Normal"
        KIRMIZI = "kirmizi", "Kırmızı"
        YESIL = "yesil", "Yeşil"
        MOR = "mor", "Mor"
        TURUNCU = "turuncu", "Turuncu"

    class ProvisionType(models.TextChoices):
        SGK = "sgk", "SGK"
        UCRETLI = "ucretli", "Ücretli"
        YESIL_KART = "yesil_kart", "Yeşil Kart"
        EMEKLI = "emekli", "Emekli Sandığı"

    prescription_no = models.CharField(max_length=32, blank=True)
    patient = models.ForeignKey(
        Customer,
        on_delete=models.PROTECT,
        related_name="prescriptions",
        limit_choices_to={"kind": Customer.Kind.PATIENT},
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="prescriptions_authored",
        null=True,
        blank=True,
    )
    oral_treatment = models.ForeignKey(
        "oral.OralTreatment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prescriptions",
    )
    diagnosis_code = models.CharField(max_length=16, blank=True)
    diagnosis_text = models.CharField(max_length=255, blank=True)
    prescription_type = models.CharField(
        max_length=16,
        choices=PrescriptionType.choices,
        default=PrescriptionType.NORMAL,
    )
    provision_type = models.CharField(
        max_length=16,
        choices=ProvisionType.choices,
        default=ProvisionType.SGK,
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    medula_reference = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)
    finalized_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "prescription"
        ordering = ["-id"]
        indexes = [
            models.Index(fields=["tenant", "patient", "status"]),
        ]

    def __str__(self) -> str:
        return self.prescription_no or f"Prescription #{self.pk}"


class PrescriptionLine(TenantOwnedModel):
    class Route(models.TextChoices):
        ORAL = "oral", "Oral"
        TOPICAL = "topical", "Topikal"
        IV = "iv", "IV"
        IM = "im", "IM"
        SC = "sc", "SC"
        OTHER = "other", "Diğer"

    prescription = models.ForeignKey(
        Prescription,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    drug = models.ForeignKey(
        DrugCatalog,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
    )
    drug_barkod = models.CharField(max_length=32, blank=True)
    drug_name = models.CharField(max_length=255)
    box_count = models.PositiveIntegerField(default=1)
    quantity_per_box = models.PositiveIntegerField(default=1)
    dose = models.CharField(max_length=64, blank=True)
    frequency = models.CharField(max_length=64, blank=True)
    period_days = models.PositiveIntegerField(default=7)
    route = models.CharField(
        max_length=16,
        choices=Route.choices,
        default=Route.ORAL,
    )
    usage_instruction = models.CharField(max_length=512, blank=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "prescription_line"
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.drug_name
