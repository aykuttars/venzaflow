from __future__ import annotations

from django.db import models
from django.db.models import Q

from apps.common.choices_enum import ChoicesEnum
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
    sku = models.CharField(max_length=64, db_index=True)
    barcode = models.CharField(max_length=64, blank=True, db_index=True)
    name = models.CharField(max_length=255)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "product"
        unique_together = [("tenant", "sku")]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "barcode"],
                condition=~models.Q(barcode=""),
                name="product_unique_tenant_barcode_nonempty",
            ),
        ]
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


class ActiveFieldDefinitionManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class FieldType(ChoicesEnum):
    TEXT = "TEXT"
    TEXTAREA = "TEXTAREA"
    NUMBER = "NUMBER"
    DECIMAL = "DECIMAL"
    BOOLEAN = "BOOLEAN"
    DATE = "DATE"
    DATETIME = "DATETIME"
    SELECT = "SELECT"
    MULTI_SELECT = "MULTI_SELECT"
    URL = "URL"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    MONEY = "MONEY"
    PERCENT = "PERCENT"
    FILE = "FILE"
    IMAGE = "IMAGE"
    JSON = "JSON"


class ProductFieldDefinition(TenantOwnedModel):
    key = models.SlugField(max_length=64)
    label = models.CharField(max_length=255)
    field_type = models.CharField(max_length=32, choices=FieldType.choices)
    description = models.TextField(blank=True)
    placeholder = models.CharField(max_length=255, blank=True)
    help_text = models.CharField(max_length=512, blank=True)
    default_value = models.JSONField(null=True, blank=True)
    is_required = models.BooleanField(default=False)
    is_unique = models.BooleanField(default=False)
    is_filterable = models.BooleanField(default=False)
    is_searchable = models.BooleanField(default=False)
    is_sortable = models.BooleanField(default=False)
    show_in_form = models.BooleanField(default=True)
    show_in_list = models.BooleanField(default=False)
    show_in_detail = models.BooleanField(default=True)
    form_order = models.PositiveIntegerField(default=0)
    list_order = models.PositiveIntegerField(default=0)
    detail_order = models.PositiveIntegerField(default=0)
    validation_rules = models.JSONField(default=dict, blank=True)
    options = models.JSONField(default=list, blank=True)
    unit = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = ActiveFieldDefinitionManager()
    all_objects = models.Manager()

    class Meta:
        db_table = "product_field_definition"
        unique_together = [("tenant", "key")]
        ordering = ["form_order", "key"]

    def __str__(self) -> str:
        return f"{self.key} ({self.label})"


class ProductFieldValue(TenantOwnedModel):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="field_values")
    field_definition = models.ForeignKey(
        ProductFieldDefinition,
        on_delete=models.CASCADE,
        related_name="values",
    )
    value_text = models.TextField(blank=True)
    value_number = models.BigIntegerField(null=True, blank=True)
    value_decimal = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    value_boolean = models.BooleanField(null=True, blank=True)
    value_date = models.DateField(null=True, blank=True)
    value_datetime = models.DateTimeField(null=True, blank=True)
    value_json = models.JSONField(null=True, blank=True)
    value_file = models.FileField(upload_to="product_fields/%Y/%m/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "product_field_value"
        unique_together = [("tenant", "product", "field_definition")]
        indexes = [
            models.Index(fields=["tenant", "product"]),
            models.Index(fields=["tenant", "field_definition"]),
        ]


class FieldSource(ChoicesEnum):
    CORE = "CORE"
    DYNAMIC = "DYNAMIC"
    COMPUTED = "COMPUTED"


class ProductListColumnConfig(TenantOwnedModel):
    field_key = models.CharField(max_length=64)
    field_source = models.CharField(max_length=16, choices=FieldSource.choices)
    label = models.CharField(max_length=255, blank=True)
    is_visible = models.BooleanField(default=True)
    is_sortable = models.BooleanField(default=False)
    is_filterable = models.BooleanField(default=False)
    width = models.CharField(max_length=32, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "product_list_column_config"
        unique_together = [("tenant", "field_key", "field_source")]
        ordering = ["order", "field_key"]


class ProductFormConfig(TenantOwnedModel):
    field_key = models.CharField(max_length=64)
    field_source = models.CharField(max_length=16, choices=FieldSource.choices)
    label = models.CharField(max_length=255, blank=True)
    is_visible = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    is_readonly = models.BooleanField(default=False)
    placeholder = models.CharField(max_length=255, blank=True)
    help_text = models.CharField(max_length=512, blank=True)
    section = models.CharField(max_length=128, default="Genel Bilgiler")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "product_form_config"
        unique_together = [("tenant", "field_key", "field_source")]
        ordering = ["section", "order", "field_key"]


class ProductDetailConfig(TenantOwnedModel):
    field_key = models.CharField(max_length=64)
    field_source = models.CharField(max_length=16, choices=FieldSource.choices)
    label = models.CharField(max_length=255, blank=True)
    section = models.CharField(max_length=128, default="Genel Bilgiler")
    is_visible = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "product_detail_config"
        unique_together = [("tenant", "field_key", "field_source")]
        ordering = ["section", "order", "field_key"]
