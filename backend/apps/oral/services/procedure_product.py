from __future__ import annotations

from apps.oral.models import ProcedureCatalog
from apps.products.models import Category, Product
from apps.tenants.models import Tenant

ORAL_CATEGORY_SLUG = "oral-hizmetleri"
ORAL_CATEGORY_NAME = "Oral Hizmetleri"


def ensure_oral_product_category(tenant: Tenant) -> Category:
    category, _ = Category.all_tenants.get_or_create(
        tenant=tenant,
        slug=ORAL_CATEGORY_SLUG,
        defaults={"name": ORAL_CATEGORY_NAME},
    )
    return category


def procedure_product_sku(code: str) -> str:
    return f"oral-{code.lower()}"


def ensure_procedure_product(procedure: ProcedureCatalog) -> Product:
    """Create or update a billing Product linked to an oral procedure."""
    tenant = procedure.tenant
    category = ensure_oral_product_category(tenant)
    sku = procedure_product_sku(procedure.code or str(procedure.pk))
    defaults = {
        "name": procedure.name,
        "category": category,
        "unit_price": procedure.default_price,
        "is_active": procedure.is_active,
    }
    if procedure.product_id:
        product = procedure.product
        product.name = procedure.name
        product.unit_price = procedure.default_price
        product.is_active = procedure.is_active
        product.save(update_fields=["name", "unit_price", "is_active"])
        return product

    product, _ = Product.all_tenants.update_or_create(
        tenant=tenant,
        sku=sku,
        defaults=defaults,
    )
    if procedure.product_id != product.id:
        procedure.product = product
        procedure.save(update_fields=["product"])
    return product
