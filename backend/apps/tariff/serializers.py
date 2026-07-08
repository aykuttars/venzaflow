from __future__ import annotations

from rest_framework import serializers

from apps.tariff.models import DentalTariff, DentalTariffItem


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
