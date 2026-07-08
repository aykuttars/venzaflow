from __future__ import annotations

from apps.oral.models import ProcedureCatalog
from apps.oral.services.procedure_product import ensure_procedure_product
from apps.tariff.models import DentalTariffItem
from apps.tariff.services.tenant_prices import effective_clinic_prices, ensure_tenant_tariff_prices
from apps.tariff.services.validation import get_active_tariff


def section_to_category(section_no: int) -> str:
    if section_no == 1:
        return ProcedureCatalog.Category.DIAGNOSIS
    if section_no == 7:
        return ProcedureCatalog.Category.PLANNING
    return ProcedureCatalog.Category.TREATMENT


def sync_tdb_procedures_for_tenant(tenant_id: int) -> dict[str, int]:
    tariff = get_active_tariff()
    if not tariff:
        return {"synced": 0, "created": 0, "updated": 0}

    ensure_tenant_tariff_prices(tenant_id, tariff=tariff)

    created = 0
    updated = 0
    items = list(tariff.items.all())
    for idx, item in enumerate(items):
        excl, incl = effective_clinic_prices(tenant_id, item)
        category = section_to_category(item.section_no)
        obj, was_created = ProcedureCatalog.all_tenants.update_or_create(
            tenant_id=tenant_id,
            code=item.code,
            defaults={
                "name": item.name,
                "category": category,
                "default_price": incl,
                "tariff_item": item,
                "is_tdb": True,
                "is_active": True,
                "sort_order": item.section_no * 1000 + idx,
            },
        )
        if was_created:
            created += 1
        else:
            changed_fields = []
            if obj.name != item.name:
                obj.name = item.name
                changed_fields.append("name")
            if obj.category != category:
                obj.category = category
                changed_fields.append("category")
            if obj.default_price != incl:
                obj.default_price = incl
                changed_fields.append("default_price")
            if obj.tariff_item_id != item.id:
                obj.tariff_item = item
                changed_fields.append("tariff_item")
            if not obj.is_tdb:
                obj.is_tdb = True
                changed_fields.append("is_tdb")
            if changed_fields:
                obj.save(update_fields=changed_fields)
                updated += 1
        ensure_procedure_product(obj)

    return {"synced": len(items), "created": created, "updated": updated}


def sync_tdb_procedures_all_tenants() -> dict[str, int]:
    from apps.tariff.services.tenant_year_sync import oral_tenant_ids

    total = 0
    for tenant_id in oral_tenant_ids():
        stats = sync_tdb_procedures_for_tenant(tenant_id)
        total += stats["synced"]
    return {"tenants": len(oral_tenant_ids()), "synced": total}
