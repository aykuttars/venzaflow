from __future__ import annotations

from django.db import models

from apps.tenants.models import TenantOwnedModel


class Category(TenantOwnedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=128)

    class Meta:
        db_table = "category"
        unique_together = [("tenant", "slug")]
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Product(TenantOwnedModel):
    sku = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "product"
        unique_together = [("tenant", "sku")]
        ordering = ["sku"]

    def __str__(self) -> str:
        return f"{self.sku} — {self.name}"


class PriceHistory(TenantOwnedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="price_history")
    price = models.DecimalField(max_digits=12, decimal_places=2)
    effective_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "price_history"
        ordering = ["-effective_at"]
