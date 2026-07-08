from __future__ import annotations

from django.db import transaction

from apps.tariff.models import DentalTariff, TenantTariffItemPrice
from apps.tariff.services.tenant_prices import enforce_override_floors, is_custom_price, prune_redundant_overrides
from apps.tenants.models import Tenant


def oral_tenant_ids() -> list[int]:
    ids: list[int] = []
    for tenant in Tenant.objects.filter(is_active=True).only("id", "enabled_modules"):
        if "oral" in (tenant.enabled_modules or []):
            ids.append(tenant.id)
    return ids


def _previous_tariff(tariff: DentalTariff) -> DentalTariff | None:
    return DentalTariff.objects.filter(year__lt=tariff.year).order_by("-year").first()


@transaction.atomic
def sync_tenant_to_active_tariff(
    tenant_id: int,
    tariff: DentalTariff,
    prev_tariff: DentalTariff | None,
) -> dict[str, int]:
    """Carry only customized tenant overrides into a newly activated tariff year."""
    if prev_tariff and prev_tariff.pk != tariff.pk:
        prev_rows = {
            row.tariff_item.code: row
            for row in TenantTariffItemPrice.objects.filter(
                tenant_id=tenant_id,
                tariff_item__tariff=prev_tariff,
            ).select_related("tariff_item")
        }
        new_items = {item.code: item for item in tariff.items.all()}

        created = 0
        carried = 0
        bumped = 0

        for code, prev in prev_rows.items():
            new_item = new_items.get(code)
            if new_item is None:
                continue
            prev_floor = prev.tariff_item.price_incl_vat
            if not is_custom_price(prev.clinic_price_incl_vat, prev_floor) and not prev.floor_bumped:
                continue

            if prev.clinic_price_incl_vat >= new_item.price_incl_vat:
                TenantTariffItemPrice.objects.update_or_create(
                    tenant_id=tenant_id,
                    tariff_item=new_item,
                    defaults={
                        "clinic_price_incl_vat": prev.clinic_price_incl_vat,
                        "floor_bumped": False,
                    },
                )
                if is_custom_price(prev.clinic_price_incl_vat, prev_floor):
                    carried += 1
                created += 1
            else:
                TenantTariffItemPrice.objects.update_or_create(
                    tenant_id=tenant_id,
                    tariff_item=new_item,
                    defaults={
                        "clinic_price_incl_vat": new_item.price_incl_vat,
                        "floor_bumped": True,
                    },
                )
                bumped += 1
                created += 1

        TenantTariffItemPrice.objects.filter(
            tenant_id=tenant_id,
            tariff_item__tariff=prev_tariff,
        ).delete()

        pruned = prune_redundant_overrides(tenant_id=tenant_id, tariff=tariff)
        return {"created": created, "carried": carried, "bumped": bumped, "pruned": pruned}

    stats = enforce_override_floors(tenant_id, tariff=tariff)
    return {"created": 0, "carried": 0, "bumped": stats["updated"], "pruned": stats["pruned"]}


def sync_active_tariff_to_all_tenants(tariff: DentalTariff | None = None) -> dict[str, int]:
    if tariff is None:
        tariff = DentalTariff.objects.filter(is_active=True).first()
    if not tariff:
        return {"tenants": 0, "created": 0, "carried": 0, "bumped": 0, "pruned": 0, "procedures": 0}

    prev_tariff = _previous_tariff(tariff)

    from apps.oral.services.tariff_procedure_sync import sync_tdb_procedures_for_tenant

    totals = {
        "tenants": 0,
        "created": 0,
        "carried": 0,
        "bumped": 0,
        "pruned": 0,
        "procedures": 0,
    }
    for tid in oral_tenant_ids():
        stats = sync_tenant_to_active_tariff(tid, tariff, prev_tariff)
        proc_stats = sync_tdb_procedures_for_tenant(tid)
        totals["tenants"] += 1
        totals["created"] += stats["created"]
        totals["carried"] += stats["carried"]
        totals["bumped"] += stats["bumped"]
        totals["pruned"] += stats.get("pruned", 0)
        totals["procedures"] += int(proc_stats.get("synced", 0))
    return totals
