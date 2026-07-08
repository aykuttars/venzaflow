from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice


def validate_clinic_price_not_below_reference(
    tariff_item: DentalTariffItem,
    incl: Decimal,
) -> None:
    if incl < tariff_item.price_incl_vat:
        raise serializers.ValidationError(
            {
                "clinic_price_incl_vat": [
                    _(
                        "%(year)s tarifesi taban fiyatı %(floor)s TL'nin altına inilemez."
                    )
                    % {"year": tariff_item.tariff.year, "floor": tariff_item.price_incl_vat}
                ]
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


def effective_clinic_incl(
    tenant_id: int,
    tariff_item: DentalTariffItem,
) -> Decimal:
    row = get_tenant_price_row(tenant_id, tariff_item)
    if row:
        return row.clinic_price_incl_vat
    return tariff_item.price_incl_vat


def effective_floor_incl(tenant_id: int, tariff_item: DentalTariffItem | None) -> Decimal | None:
    if tariff_item is None:
        return None
    return tariff_item.price_incl_vat


def is_custom_price(incl: Decimal, floor: Decimal) -> bool:
    return incl > floor


@transaction.atomic
def save_tenant_clinic_price(
    tenant_id: int,
    tariff_item: DentalTariffItem,
    incl: Decimal,
) -> TenantTariffItemPrice | None:
    """Persist a tenant override only when price differs from the base tariff."""
    validate_clinic_price_not_below_reference(tariff_item, incl)
    floor = tariff_item.price_incl_vat
    if incl == floor:
        TenantTariffItemPrice.objects.filter(
            tenant_id=tenant_id,
            tariff_item=tariff_item,
        ).delete()
        return None
    row, _ = TenantTariffItemPrice.objects.update_or_create(
        tenant_id=tenant_id,
        tariff_item=tariff_item,
        defaults={
            "clinic_price_incl_vat": incl,
            "floor_bumped": False,
        },
    )
    return row


@transaction.atomic
def enforce_override_floors(tenant_id: int, tariff: DentalTariff | None = None) -> dict[str, int]:
    """Raise existing tenant overrides that sit below the current base tariff."""
    if tariff is None:
        tariff = DentalTariff.objects.filter(is_active=True).first()
    if not tariff:
        return {"updated": 0, "pruned": 0}

    updated = 0
    for row in TenantTariffItemPrice.objects.filter(
        tenant_id=tenant_id,
        tariff_item__tariff=tariff,
    ).select_related("tariff_item"):
        floor = row.tariff_item.price_incl_vat
        if row.clinic_price_incl_vat < floor:
            row.clinic_price_incl_vat = floor
            row.floor_bumped = True
            row.save(update_fields=["clinic_price_incl_vat", "floor_bumped", "updated_at"])
            updated += 1

    pruned = prune_redundant_overrides(tenant_id=tenant_id, tariff=tariff)
    return {"updated": updated, "pruned": pruned}


@transaction.atomic
def prune_redundant_overrides(
    tenant_id: int | None = None,
    tariff: DentalTariff | None = None,
) -> int:
    """Drop override rows that mirror the base price (no bump flag)."""
    qs = TenantTariffItemPrice.objects.filter(
        clinic_price_incl_vat=F("tariff_item__price_incl_vat"),
        floor_bumped=False,
    )
    if tenant_id is not None:
        qs = qs.filter(tenant_id=tenant_id)
    if tariff is not None:
        qs = qs.filter(tariff_item__tariff=tariff)
    deleted, _ = qs.delete()
    return deleted
