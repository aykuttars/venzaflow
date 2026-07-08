from __future__ import annotations

from decimal import Decimal

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.oral.models import ProcedureCatalog
from apps.tariff.models import DentalTariff, DentalTariffItem
from apps.tariff.services.tenant_prices import effective_clinic_prices, effective_floor_incl


def get_active_tariff() -> DentalTariff | None:
    return DentalTariff.objects.filter(is_active=True).first()


def floor_price_for_item(tariff_item: DentalTariffItem | None) -> Decimal | None:
    if tariff_item is None:
        return None
    return tariff_item.price_incl_vat


def floor_price_for_procedure(procedure: ProcedureCatalog, tenant_id: int | None = None) -> Decimal | None:
    if not procedure.tariff_item_id:
        return None
    tid = tenant_id or procedure.tenant_id
    return effective_floor_incl(tid, procedure.tariff_item)


def validate_price_not_below_floor(
    price: Decimal,
    tariff_item: DentalTariffItem | None,
    *,
    field_name: str = "default_price",
    tenant_id: int | None = None,
) -> None:
    floor = effective_floor_incl(tenant_id, tariff_item) if tenant_id else floor_price_for_item(tariff_item)
    if floor is None:
        return
    if price < floor:
        tariff = tariff_item.tariff if tariff_item else get_active_tariff()
        year = tariff.year if tariff else "?"
        raise serializers.ValidationError(
            {
                field_name: _(
                    "%(year)s tarifesi taban fiyatı %(floor)s TL'nin altına inilemez."
                )
                % {"year": year, "floor": floor}
            }
        )


def list_procedure_violations(tenant_id: int) -> list[dict]:
    active = get_active_tariff()
    if not active:
        return []
    violations = []
    qs = (
        ProcedureCatalog.objects.filter(tenant_id=tenant_id, tariff_item__isnull=False)
        .select_related("tariff_item", "tariff_item__tariff")
        .order_by("sort_order", "name")
    )
    for proc in qs:
        floor = effective_floor_incl(tenant_id, proc.tariff_item)
        if floor is None:
            continue
        _, incl = effective_clinic_prices(tenant_id, proc.tariff_item)
        check_price = incl if proc.is_tdb else proc.default_price
        if check_price < floor:
            violations.append(
                {
                    "procedure_id": proc.id,
                    "procedure_code": proc.code,
                    "procedure_name": proc.name,
                    "current_price": str(check_price),
                    "floor_price": str(floor),
                    "tariff_code": proc.tariff_item.code,
                    "tariff_item_name": proc.tariff_item.name,
                    "tariff_year": proc.tariff_item.tariff.year,
                }
            )
    return violations
