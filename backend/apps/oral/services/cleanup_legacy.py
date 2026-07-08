from __future__ import annotations

from apps.billing.models import InvoiceLine
from apps.oral.models import OralTreatment, ProcedureCatalog
from apps.oral.seed_data import LEGACY_DEMO_PROCEDURE_CODES
from apps.products.models import Product


def cleanup_legacy_demo_procedures(tenant_id: int) -> dict[str, int]:
    """Remove pre-TDB demo procedure rows and their billing product mirrors."""
    legacy_qs = ProcedureCatalog.all_tenants.filter(
        tenant_id=tenant_id,
        is_tdb=False,
        code__in=LEGACY_DEMO_PROCEDURE_CODES,
    )
    product_ids = list(
        legacy_qs.exclude(product_id__isnull=True).values_list("product_id", flat=True)
    )
    treatment_qs = OralTreatment.all_tenants.filter(
        tenant_id=tenant_id,
        procedure__in=legacy_qs,
    )
    invoice_lines_cleared = InvoiceLine.all_tenants.filter(
        tenant_id=tenant_id,
        oral_treatment__in=treatment_qs,
    ).update(oral_treatment=None)
    treatments_deleted, _ = treatment_qs.delete()
    procedures_deleted, _ = legacy_qs.delete()

    counters = {"deleted": 0, "deactivated": 0}
    for product_id in product_ids:
        product = Product.all_tenants.filter(pk=product_id, tenant_id=tenant_id).first()
        if product:
            _retire_oral_product(product, tenant_id, counters)

    legacy_skus = {f"oral-{code.lower()}" for code in LEGACY_DEMO_PROCEDURE_CODES}
    for product in Product.all_tenants.filter(tenant_id=tenant_id, sku__in=legacy_skus):
        if not product.oral_procedures.exists():
            _retire_oral_product(product, tenant_id, counters)

    return {
        "procedures_deleted": procedures_deleted,
        "treatments_deleted": treatments_deleted,
        "invoice_lines_cleared": invoice_lines_cleared,
        "products_deleted": counters["deleted"],
        "products_deactivated": counters["deactivated"],
    }


def _retire_oral_product(product: Product, tenant_id: int, counters: dict[str, int]) -> None:
    if InvoiceLine.all_tenants.filter(tenant_id=tenant_id, product=product).exists():
        if product.is_active:
            product.is_active = False
            product.save(update_fields=["is_active"])
            counters["deactivated"] += 1
        return
    product.delete()
    counters["deleted"] += 1
