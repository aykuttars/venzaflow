from __future__ import annotations

from django.db import models

from apps.products.models import Product
from apps.tenants.models import TenantOwnedModel


class Warehouse(TenantOwnedModel):
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)

    class Meta:
        unique_together = [("tenant", "code")]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Stock(TenantOwnedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_levels")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_levels")
    quantity = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=0)

    class Meta:
        unique_together = [("tenant", "product", "warehouse")]

    def __str__(self) -> str:
        return f"{self.product.sku} @ {self.warehouse.code}: {self.quantity}"


class StockMovement(TenantOwnedModel):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="movements")
    delta = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True)
    reference = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
