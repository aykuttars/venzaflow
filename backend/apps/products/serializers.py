from __future__ import annotations

from django.db.models import Sum
from rest_framework import serializers

from apps.inventory.models import Stock
from apps.products.field_validation import FieldValidationError, serialize_field_value, validate_field_value
from apps.products.models import (
    Category,
    FieldSource,
    PriceHistory,
    Product,
    ProductDetailConfig,
    ProductFieldDefinition,
    ProductFieldValue,
    ProductFormConfig,
    ProductListColumnConfig,
)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "slug")


class ProductFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductFieldDefinition
        fields = (
            "id",
            "key",
            "label",
            "field_type",
            "description",
            "placeholder",
            "help_text",
            "default_value",
            "is_required",
            "is_unique",
            "is_filterable",
            "is_searchable",
            "is_sortable",
            "show_in_form",
            "show_in_list",
            "show_in_detail",
            "form_order",
            "list_order",
            "detail_order",
            "validation_rules",
            "options",
            "unit",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def create(self, validated_data):
        request = self.context.get("request")
        tenant_id = getattr(request.user, "tenant_id", None) if request else None
        return super().create(validated_data)


class ProductFieldValueSerializer(serializers.ModelSerializer):
    field_key = serializers.CharField(source="field_definition.key", read_only=True)
    value = serializers.SerializerMethodField()

    class Meta:
        model = ProductFieldValue
        fields = (
            "id",
            "product",
            "field_definition",
            "field_key",
            "value",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def get_value(self, obj: ProductFieldValue):
        return serialize_field_value(obj)


class ProductListColumnConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductListColumnConfig
        fields = (
            "id",
            "field_key",
            "field_source",
            "label",
            "is_visible",
            "is_sortable",
            "is_filterable",
            "width",
            "order",
        )


class ProductFormConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductFormConfig
        fields = (
            "id",
            "field_key",
            "field_source",
            "label",
            "is_visible",
            "is_required",
            "is_readonly",
            "placeholder",
            "help_text",
            "section",
            "order",
        )


class ProductDetailConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductDetailConfig
        fields = (
            "id",
            "field_key",
            "field_source",
            "label",
            "section",
            "is_visible",
            "order",
        )


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    custom_fields = serializers.DictField(child=serializers.JSONField(), required=False, write_only=True)
    dynamic_fields = serializers.SerializerMethodField()
    total_stock = serializers.SerializerMethodField()
    available_stock = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = (
            "id",
            "sku",
            "barcode",
            "name",
            "category",
            "category_name",
            "unit_price",
            "cost_price",
            "is_active",
            "custom_fields",
            "dynamic_fields",
            "total_stock",
            "available_stock",
        )

    def get_dynamic_fields(self, obj: Product) -> dict:
        if not self.context.get("include_fields"):
            return {}
        values = obj.field_values.select_related("field_definition").all()
        return {v.field_definition.key: serialize_field_value(v) for v in values}

    def get_total_stock(self, obj: Product) -> int:
        agg = Stock.objects.filter(tenant_id=obj.tenant_id, product=obj).aggregate(
            total=Sum("quantity")
        )
        return int(agg["total"] or 0)

    def get_available_stock(self, obj: Product) -> int:
        rows = Stock.objects.filter(tenant_id=obj.tenant_id, product=obj)
        return sum(max(0, r.quantity - r.reserved_quantity) for r in rows)

    def _save_custom_fields(self, product: Product, custom_fields: dict | None) -> None:
        if custom_fields is None:
            return
        tenant_id = product.tenant_id
        definitions = {
            d.key: d
            for d in ProductFieldDefinition.objects.filter(tenant_id=tenant_id, is_active=True)
        }
        errors = {}
        for key, raw in custom_fields.items():
            definition = definitions.get(key)
            if not definition:
                errors[key] = "Unknown field"
                continue
            try:
                storage = validate_field_value(
                    definition, raw, product=product, tenant_id=tenant_id
                )
            except FieldValidationError as exc:
                errors[key] = exc.messages[0] if exc.messages else str(exc)
                continue
            ProductFieldValue.objects.update_or_create(
                tenant_id=tenant_id,
                product=product,
                field_definition=definition,
                defaults=storage,
            )
        if errors:
            raise serializers.ValidationError({"custom_fields": errors})

    def create(self, validated_data):
        custom_fields = validated_data.pop("custom_fields", None)
        product = super().create(validated_data)
        self._save_custom_fields(product, custom_fields)
        return product

    def update(self, instance, validated_data):
        custom_fields = validated_data.pop("custom_fields", None)
        product = super().update(instance, validated_data)
        self._save_custom_fields(product, custom_fields)
        return product


class PriceHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceHistory
        fields = ("id", "product", "price", "effective_at")
