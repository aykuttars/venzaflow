from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.products.models import Product
from apps.tenants.models import TenantOwnedModel


class LabelTemplateSource(models.TextChoices):
    DEFAULT = "default", "Default"
    CUSTOM = "custom", "Custom"
    DUPLICATE = "duplicate", "Duplicate"


class LabelTemplate(TenantOwnedModel):
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    width_mm = models.DecimalField(max_digits=6, decimal_places=2)
    height_mm = models.DecimalField(max_digits=6, decimal_places=2)
    gap_mm = models.DecimalField(max_digits=6, decimal_places=2, default=2)
    dpi = models.PositiveIntegerField(default=203)
    layout_json = models.JSONField(default=list)
    source = models.CharField(
        max_length=16,
        choices=LabelTemplateSource.choices,
        default=LabelTemplateSource.CUSTOM,
    )
    default_key = models.CharField(max_length=64, blank=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "label_template"
        indexes = [
            models.Index(fields=["tenant_id", "is_active"]),
            models.Index(fields=["tenant_id", "default_key"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant_id", "default_key"],
                condition=~models.Q(default_key=""),
                name="label_template_unique_default_key",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class BarcodeAssignment(TenantOwnedModel):
    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name="barcode_assignment",
    )
    symbology = models.CharField(max_length=16, default="EAN13")
    qr_payload = models.CharField(max_length=512, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "barcode_assignment"

    def __str__(self) -> str:
        return f"{self.product.sku} → {self.symbology}"


class PrintJobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    SENT = "sent", "Sent"
    DONE = "done", "Done"
    FAILED = "failed", "Failed"


class PrintJob(TenantOwnedModel):
    template = models.ForeignKey(
        LabelTemplate,
        on_delete=models.PROTECT,
        related_name="print_jobs",
    )
    product_ids = models.JSONField(default=list)
    layout_snapshot = models.JSONField(default=list)
    template_snapshot = models.JSONField(default=dict)
    status = models.CharField(
        max_length=16,
        choices=PrintJobStatus.choices,
        default=PrintJobStatus.QUEUED,
    )
    copies = models.PositiveIntegerField(default=1)
    error_message = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="barcode_print_jobs",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "barcode_print_job"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant_id", "status"]),
            models.Index(fields=["tenant_id", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"PrintJob #{self.pk} ({self.status})"
