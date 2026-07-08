from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice
from apps.tariff.services.tenant_prices import get_tenant_price_row


class DentalTariffItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DentalTariffItem
        fields = (
            "id",
            "section_no",
            "section_name",
            "code",
            "name",
            "price_incl_vat",
        )


class TenantTariffItemListSerializer(serializers.ModelSerializer):
    """Only the canonical VAT-included prices are returned; the UI derives the
    VAT-excluded amount from the tariff's vat_rate (exposed on the list payload)."""

    reference_incl = serializers.DecimalField(
        source="price_incl_vat", max_digits=12, decimal_places=2, read_only=True
    )
    floor_incl = serializers.DecimalField(
        source="price_incl_vat", max_digits=12, decimal_places=2, read_only=True
    )
    clinic_incl = serializers.SerializerMethodField()
    is_customizable = serializers.SerializerMethodField()
    floor_bumped = serializers.SerializerMethodField()

    class Meta:
        model = DentalTariffItem
        fields = (
            "id",
            "section_no",
            "section_name",
            "code",
            "name",
            "reference_incl",
            "floor_incl",
            "clinic_incl",
            "is_customizable",
            "floor_bumped",
        )

    def _tenant_id(self) -> int:
        request = self.context.get("request")
        return request.user.tenant_id if request else 0

    def _row(self, obj: DentalTariffItem):
        rows = self.context.get("rows_by_item")
        if rows is not None:
            return rows.get(obj.id)
        return get_tenant_price_row(self._tenant_id(), obj)

    def get_clinic_incl(self, obj: DentalTariffItem) -> Decimal:
        row = self._row(obj)
        return row.clinic_price_incl_vat if row else obj.price_incl_vat

    def get_is_customizable(self, obj: DentalTariffItem) -> bool:
        return True

    def get_floor_bumped(self, obj: DentalTariffItem) -> bool:
        row = self._row(obj)
        return bool(row and row.floor_bumped)


class ClinicPriceUpdateSerializer(serializers.Serializer):
    clinic_price_incl_vat = serializers.DecimalField(max_digits=12, decimal_places=2)


class DentalTariffSerializer(serializers.ModelSerializer):
    item_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = DentalTariff
        fields = (
            "id",
            "year",
            "title",
            "source_note",
            "is_active",
            "imported_at",
            "updated_at",
            "item_count",
        )


class DentalTariffDetailSerializer(DentalTariffSerializer):
    items = DentalTariffItemSerializer(many=True, read_only=True)

    class Meta(DentalTariffSerializer.Meta):
        fields = DentalTariffSerializer.Meta.fields + ("items",)
