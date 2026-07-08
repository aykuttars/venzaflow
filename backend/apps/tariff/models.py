from __future__ import annotations

from django.db import models


class DentalTariff(models.Model):
    """Platform-level TDB rehber tarife (one active year at a time)."""

    year = models.PositiveIntegerField(unique=True)
    title = models.CharField(max_length=255)
    source_note = models.CharField(max_length=512, blank=True)
    is_active = models.BooleanField(default=False)
    imported_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "dental_tariff"
        ordering = ["-year"]

    def __str__(self) -> str:
        active = " (active)" if self.is_active else ""
        return f"{self.year} {self.title}{active}"


class DentalTariffItem(models.Model):
    tariff = models.ForeignKey(
        DentalTariff,
        on_delete=models.CASCADE,
        related_name="items",
    )
    section_no = models.PositiveSmallIntegerField()
    section_name = models.CharField(max_length=128)
    code = models.CharField(max_length=16)
    name = models.CharField(max_length=512)
    price_incl_vat = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="TDB reference price, VAT included (canonical). VAT-excl is derived.",
    )

    class Meta:
        db_table = "dental_tariff_item"
        ordering = ["section_no", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["tariff", "code"],
                name="dental_tariff_item_unique_code",
            ),
        ]
        indexes = [
            models.Index(fields=["tariff", "code"]),
            models.Index(fields=["tariff", "name"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} {self.name}"


class TenantTariffItemPrice(models.Model):
    """Tenant-specific price override. Row exists only when clinic price != base tariff."""

    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="tariff_item_prices",
    )
    tariff_item = models.ForeignKey(
        DentalTariffItem,
        on_delete=models.CASCADE,
        related_name="tenant_prices",
    )
    clinic_price_incl_vat = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        help_text="Clinic price, VAT included (canonical). VAT-excl is derived in UI.",
    )
    floor_bumped = models.BooleanField(
        default=False,
        help_text="True when a yearly tariff update raised this price to the new floor.",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant_tariff_item_price"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "tariff_item"],
                name="tenant_tariff_item_price_unique",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "tariff_item"]),
        ]

    def __str__(self) -> str:
        return f"{self.tenant_id} {self.tariff_item.code} incl={self.clinic_price_incl_vat}"


# NOTE: VAT-excluded prices are intentionally NOT stored. Dental KDV is a fixed
# system tax rate; the VAT-excluded amount is derived from the canonical
# VAT-included price at display/invoice time to avoid two columns drifting apart.
