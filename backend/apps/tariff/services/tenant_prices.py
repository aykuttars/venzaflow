from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice


def validate_clinic_prices_not_below_reference(
    tariff_item: DentalTariffItem,
    excl: Decimal,
    incl: Decimal,
) -> None:
    if excl < tariff_item.price_excl_vat:
        raise serializers.ValidationError(
            {
                "clinic_price_excl_vat": _(
                    "Klinik KDV hariç fiyat taban fiyatın (%(floor)s TL) altında olamaz."
                )
                % {"floor": tariff_item.price_excl_vat}
            }
        )
    if incl < tariff_item.price_incl_vat:
        raise serializers.ValidationError(
            {
                "clinic_price_incl_vat": _(
                    "%(year)s tarifesi taban fiyatı %(floor)s TL'nin altına inilemez."
                )
                % {"year": tariff_item.tariff.year, "floor": tariff_item.price_incl_vat}
            }
        )


def get_tenant_price_row(
    tenant_id: int,
    tariff_item: DentalTariffItem,
) -> TenantTariffItemPrice | None:
    return TenantTariffItemPrice.objects.filter(
        tenant_id=tenant_id,
        tariff_item=tariff_item,
    ).first()


def effective_clinic_prices(
    tenant_id: int,
    tariff_item: DentalTariffItem,
) -> tuple[Decimal, Decimal]:
    row = get_tenant_price_row(tenant_id, tariff_item)
    if row:
        return row.clinic_price_excl_vat, row.clinic_price_incl_vat
    return tariff_item.price_excl_vat, tariff_item.price_incl_vat


def effective_floor_incl(tenant_id: int, tariff_item: DentalTariffItem | None) -> Decimal | None:
    if tariff_item is None:
        return None
    return tariff_item.price_incl_vat


@transaction.atomic
def ensure_tenant_tariff_prices(tenant_id: int, tariff: DentalTariff | None = None) -> dict[str, int]:
    """Create missing tenant price rows at reference floor for all items in active tariff."""
    if tariff is None:
        tariff = DentalTariff.objects.filter(is_active=True).first()
    if not tariff:
        return {"created": 0, "updated": 0, "total": 0}

    created = 0
    updated = 0
    for item in tariff.items.all().iterator():
        row, was_created = TenantTariffItemPrice.objects.get_or_create(
            tenant_id=tenant_id,
            tariff_item=item,
            defaults={
                "clinic_price_excl_vat": item.price_excl_vat,
                "clinic_price_incl_vat": item.price_incl_vat,
            },
        )
        if was_created:
            created += 1
            continue
        bumped = False
        if row.clinic_price_excl_vat < item.price_excl_vat:
            row.clinic_price_excl_vat = item.price_excl_vat
            bumped = True
        if row.clinic_price_incl_vat < item.price_incl_vat:
            row.clinic_price_incl_vat = item.price_incl_vat
            bumped = True
        if bumped:
            row.save(update_fields=["clinic_price_excl_vat", "clinic_price_incl_vat", "updated_at"])
            updated += 1

    return {
        "created": created,
        "updated": updated,
        "total": tariff.items.count(),
    }
