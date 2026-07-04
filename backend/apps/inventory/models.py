from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.common.choices_enum import ChoicesEnum
from apps.products.models import Product
from apps.tenants.models import TenantOwnedModel


class Warehouse(TenantOwnedModel):
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    label_template = models.ForeignKey(
        "barcode.LabelTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="warehouses",
    )

    class Meta:
        db_table = "warehouse"
        unique_together = [("tenant", "code")]
        indexes = [
            models.Index(fields=["tenant", "code"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Location(TenantOwnedModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="locations")
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    label_template = models.ForeignKey(
        "barcode.LabelTemplate",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="locations",
    )

    class Meta:
        db_table = "location"
        unique_together = [("tenant", "warehouse", "code")]
        indexes = [
            models.Index(fields=["tenant", "warehouse"]),
            models.Index(fields=["tenant", "warehouse", "code"]),
        ]

    def __str__(self) -> str:
        return f"{self.warehouse.code}/{self.code} — {self.name}"


class Stock(TenantOwnedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_levels")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stock_levels")
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="stock_levels",
        null=True,
        blank=True,
    )
    quantity = models.IntegerField(default=0)
    reserved_quantity = models.IntegerField(default=0)
    reorder_level = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "stock"
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "product", "warehouse"],
                condition=Q(location__isnull=True),
                name="stock_unique_tenant_product_wh_no_loc",
            ),
            models.UniqueConstraint(
                fields=["tenant", "product", "warehouse", "location"],
                condition=Q(location__isnull=False),
                name="stock_unique_tenant_product_wh_loc",
            ),
            models.CheckConstraint(check=Q(quantity__gte=0), name="stock_quantity_non_negative"),
            models.CheckConstraint(
                check=Q(reserved_quantity__gte=0),
                name="stock_reserved_non_negative",
            ),
        ]
        indexes = [
            models.Index(fields=["tenant", "product"]),
            models.Index(fields=["tenant", "warehouse"]),
            models.Index(fields=["tenant", "warehouse", "location"]),
        ]

    @property
    def available_quantity(self) -> int:
        return max(0, self.quantity - self.reserved_quantity)

    def __str__(self) -> str:
        loc = self.location.code if self.location_id else "—"
        return f"{self.product.sku} @ {self.warehouse.code}/{loc}: {self.quantity}"


class MovementType(ChoicesEnum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    RETURN = "RETURN"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    ADJUSTMENT = "ADJUSTMENT"
    DAMAGE = "DAMAGE"
    INITIAL_COUNT = "INITIAL_COUNT"


INBOUND_MOVEMENT_TYPES = frozenset(
    {
        MovementType.PURCHASE.value,
        MovementType.RETURN.value,
        MovementType.TRANSFER_IN.value,
        MovementType.INITIAL_COUNT.value,
    }
)
OUTBOUND_MOVEMENT_TYPES = frozenset(
    {
        MovementType.SALE.value,
        MovementType.TRANSFER_OUT.value,
        MovementType.DAMAGE.value,
    }
)


class StockMovement(TenantOwnedModel):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name="movements")
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        null=True,
        blank=True,
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="stock_movements",
        null=True,
        blank=True,
    )
    movement_type = models.CharField(
        max_length=32,
        choices=MovementType.choices,
        default=MovementType.ADJUSTMENT.value,
    )
    quantity = models.PositiveIntegerField(default=0)
    delta = models.IntegerField()
    previous_quantity = models.IntegerField(default=0)
    new_quantity = models.IntegerField(default=0)
    reason = models.CharField(max_length=255, blank=True)
    note = models.TextField(blank=True)
    reference = models.CharField(max_length=128, blank=True)
    reference_type = models.CharField(max_length=64, blank=True)
    reference_id = models.CharField(max_length=64, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stock_movements",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "stock_movement"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["tenant", "stock"]),
            models.Index(fields=["tenant", "product"]),
            models.Index(fields=["tenant", "warehouse"]),
            models.Index(fields=["tenant", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.movement_type} {self.delta:+d} on stock #{self.stock_id}"
