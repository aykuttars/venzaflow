from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.products.models import Product
from apps.tenants.models import Tenant, TenantOwnedModel


class ScanMissAction(models.TextChoices):
    IGNORE = "ignore", "Ignore"
    ASSIGN_EXISTING = "assign_existing", "Assign to existing product"
    CREATE_WIZARD = "create_wizard", "Create product wizard"


class QrContentMode(models.TextChoices):
    BARCODE = "barcode", "Barcode only"
    SKU = "sku", "SKU only"
    COMPACT_DETAIL = "compact_detail", "Compact product detail"


class StockDeductionMode(models.TextChoices):
    OFF = "off", "Off"
    ON_INVOICE = "on_invoice", "On invoice"
    ON_MANUAL_CONFIRM = "on_manual_confirm", "Manual confirm"
    BOTH = "both", "Both"


class PrintMode(models.TextChoices):
    QUEUE_ONLY = "queue_only", "Queue only"
    IMMEDIATE = "immediate", "Immediate"
    BOTH = "both", "Both"


class BarcodeSettings(models.Model):
    tenant = models.OneToOneField(
        Tenant,
        on_delete=models.CASCADE,
        related_name="barcode_settings",
    )
    scan_miss_action = models.CharField(
        max_length=32,
        choices=ScanMissAction.choices,
        default=ScanMissAction.CREATE_WIZARD,
    )
    normalize_tr_scan = models.BooleanField(default=True)
    qr_content_mode = models.CharField(
        max_length=32,
        choices=QrContentMode.choices,
        default=QrContentMode.BARCODE,
    )
    qr_max_length = models.PositiveIntegerField(default=128)
    ean_prefix = models.CharField(max_length=3, default="869")
    auto_generate_on_create = models.BooleanField(default=False)
    default_label_template = models.ForeignKey(
        "LabelTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tenant_defaults",
    )
    operation_flags = models.JSONField(default=dict)
    stock_deduction_mode = models.CharField(
        max_length=32,
        choices=StockDeductionMode.choices,
        default=StockDeductionMode.BOTH,
    )
    print_mode = models.CharField(
        max_length=32,
        choices=PrintMode.choices,
        default=PrintMode.BOTH,
    )
    default_copies = models.PositiveIntegerField(default=1)
    default_transfer_qty = models.PositiveIntegerField(default=1)
    printer_model = models.CharField(max_length=64, default="XP-P328B")
    printer_profile_json = models.JSONField(default=dict)
    label_logo = models.ImageField(upload_to="barcode/logos/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "barcode_settings"

    def __str__(self) -> str:
        return f"BarcodeSettings tenant={self.tenant_id}"


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
    allowed_department_keys = models.JSONField(default=list, blank=True)
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
