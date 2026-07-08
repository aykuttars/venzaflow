from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice
from apps.tariff.services.tenant_prices import effective_clinic_prices


class DentalTariffItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = DentalTariffItem
        fields = (
            "id",
            "section_no",
            "section_name",
            "code",
            "name",
            "price_excl_vat",
            "price_incl_vat",
        )


class TenantTariffItemListSerializer(serializers.ModelSerializer):
    reference_excl = serializers.DecimalField(
        source="price_excl_vat", max_digits=12, decimal_places=2, read_only=True
    )
    reference_incl = serializers.DecimalField(
        source="price_incl_vat", max_digits=12, decimal_places=2, read_only=True
    )
    floor_incl = serializers.DecimalField(
        source="price_incl_vat", max_digits=12, decimal_places=2, read_only=True
    )
    clinic_excl = serializers.SerializerMethodField()
    clinic_incl = serializers.SerializerMethodField()
    is_customizable = serializers.SerializerMethodField()

    class Meta:
        model = DentalTariffItem
        fields = (
            "id",
            "section_no",
            "section_name",
            "code",
            "name",
            "reference_excl",
            "reference_incl",
            "floor_incl",
            "clinic_excl",
            "clinic_incl",
            "is_customizable",
        )

    def _tenant_id(self) -> int:
        request = self.context.get("request")
        return request.user.tenant_id if request else 0

    def get_clinic_excl(self, obj: DentalTariffItem) -> Decimal:
        excl, _ = effective_clinic_prices(self._tenant_id(), obj)
        return excl

    def get_clinic_incl(self, obj: DentalTariffItem) -> Decimal:
        _, incl = effective_clinic_prices(self._tenant_id(), obj)
        return incl

    def get_is_customizable(self, obj: DentalTariffItem) -> bool:
        return True


class ClinicPriceUpdateSerializer(serializers.Serializer):
    changed = serializers.ChoiceField(choices=("excl", "incl"))
    clinic_price_excl_vat = serializers.DecimalField(max_digits=12, decimal_places=2)
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
