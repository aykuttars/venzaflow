from __future__ import annotations

from decimal import Decimal

from django.db import models

from apps.tenants.models import Tenant


class Currency(models.Model):
    code = models.CharField(max_length=8, primary_key=True)
    name = models.CharField(max_length=64)
    symbol = models.CharField(max_length=8)
    tcmb_code = models.CharField(
        max_length=8,
        blank=True,
        null=True,
        help_text="TCMB forex code in today.xml (e.g. USD, EUR, GBP). Null for manual-only currencies.",
    )
    decimal_places = models.PositiveSmallIntegerField(default=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "platform_currency"
        ordering = ["code"]
        verbose_name_plural = "currencies"

    def __str__(self) -> str:
        return self.code


class ExchangeRate(models.Model):
    class Source(models.TextChoices):
        TCMB = "tcmb", "TCMB"
        MANUAL = "manual", "Manual"

    currency = models.ForeignKey(
        Currency,
        on_delete=models.CASCADE,
        related_name="exchange_rates",
    )
    rate_to_try = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        help_text="How many TRY for 1 unit of currency.",
    )
    source = models.CharField(max_length=16, choices=Source.choices)
    fetched_at = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "platform_exchange_rate"
        ordering = ["-fetched_at"]
        indexes = [
            models.Index(fields=["currency", "-fetched_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.currency_id}={self.rate_to_try} ({self.source})"


class TaxType(models.Model):
    code = models.CharField(max_length=16, unique=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "platform_tax_type"
        ordering = ["code"]

    def __str__(self) -> str:
        return self.code


class TaxRate(models.Model):
    tax_type = models.ForeignKey(
        TaxType,
        on_delete=models.PROTECT,
        related_name="rates",
    )
    rate_percent = models.DecimalField(max_digits=8, decimal_places=4)
    is_active = models.BooleanField(default=True)
    valid_from = models.DateField()
    valid_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "platform_tax_rate"
        ordering = ["tax_type__code", "-valid_from"]

    def __str__(self) -> str:
        return f"{self.tax_type.code} {self.rate_percent}%"


class ModulePrice(models.Model):
    module_slug = models.CharField(max_length=64, unique=True)
    price_per_user_monthly = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="TRY per active user per month for this module.",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "platform_module_price"
        ordering = ["module_slug"]

    def __str__(self) -> str:
        return f"{self.module_slug}: {self.price_per_user_monthly}"


class PlatformBillingSettings(models.Model):
    """Singleton platform billing configuration."""

    yearly_discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("15.00"),
    )
    invoice_prefix = models.CharField(max_length=16, default="TEN")
    default_payment_terms_days = models.PositiveSmallIntegerField(default=7)
    company_name = models.CharField(max_length=255, default="Tenancysoft")
    company_tax_id = models.CharField(max_length=32, blank=True)
    company_address = models.TextField(blank=True)

    class Meta:
        db_table = "platform_billing_settings"
        verbose_name_plural = "platform billing settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls) -> PlatformBillingSettings:
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self) -> str:
        return "Platform billing settings"


class TenantSubscriptionInvoice(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        ISSUED = "issued", "Issued"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"
        CANCELLED = "cancelled", "Cancelled"

    class BillingPeriod(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="subscription_invoices",
    )
    number = models.CharField(max_length=32, unique=True)
    period_start = models.DateField()
    period_end = models.DateField()
    billing_period = models.CharField(max_length=16, choices=BillingPeriod.choices)
    currency = models.ForeignKey(Currency, on_delete=models.PROTECT)
    fx_rate_to_try = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        help_text="TRY per 1 invoice currency unit at issue time.",
    )
    subtotal_excl_tax = models.DecimalField(max_digits=14, decimal_places=2)
    tax_lines = models.JSONField(default=list)
    total_incl_tax = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    issued_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant_subscription_invoice"
        ordering = ["-period_end", "-number"]

    def __str__(self) -> str:
        return self.number


class TenantSubscriptionInvoiceLine(models.Model):
    invoice = models.ForeignKey(
        TenantSubscriptionInvoice,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    module_slug = models.CharField(max_length=64, blank=True)
    description = models.CharField(max_length=255)
    user_count = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=14, decimal_places=4)
    months = models.PositiveSmallIntegerField(default=1)
    amount_excl_tax = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "tenant_subscription_invoice_line"
        ordering = ["id"]

    def __str__(self) -> str:
        return f"{self.invoice.number}: {self.description}"


class TenantSubscriptionPayment(models.Model):
    invoice = models.ForeignKey(
        TenantSubscriptionInvoice,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_at = models.DateTimeField()
    method = models.CharField(max_length=64, default="bank_transfer")
    reference = models.CharField(max_length=128, blank=True)

    class Meta:
        db_table = "tenant_subscription_payment"
        ordering = ["-paid_at"]
