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
    price_excl_vat = models.DecimalField(max_digits=12, decimal_places=2)
    price_incl_vat = models.DecimalField(max_digits=12, decimal_places=2)

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
