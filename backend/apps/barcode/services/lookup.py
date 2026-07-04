from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.db.models import Sum

from apps.barcode.services.product_fields import product_field_map
from apps.inventory.models import Stock
from apps.products.models import Product

def _stock_by_warehouse(tenant_id: int, product_id: int) -> dict[str, Any]:
    rows = (
        Stock.objects.filter(tenant_id=tenant_id, product_id=product_id)
        .select_related("warehouse", "location")
        .values("warehouse__code", "warehouse__name", "location__code")
        .annotate(qty=Sum("quantity"))
    )
    depo_qty = 0
    magaza_qty = 0
    breakdown: list[dict] = []
    for row in rows:
        code = row["warehouse__code"] or ""
        qty = int(row["qty"] or 0)
        breakdown.append(
            {
                "warehouse_code": code,
                "warehouse_name": row["warehouse__name"],
                "location_code": row["location__code"],
                "quantity": qty,
            }
        )
        if code == "DEPO":
            depo_qty += qty
        elif code == "MAGAZA":
            magaza_qty += qty
    return {
        "depo_quantity": depo_qty,
        "magaza_quantity": magaza_qty,
        "total_quantity": depo_qty + magaza_qty,
        "breakdown": breakdown,
    }


def lookup_barcode(tenant_id: int, code: str) -> dict[str, Any] | None:
    code = (code or "").strip()
    if not code:
        return None
    product = (
        Product.objects.filter(tenant_id=tenant_id, barcode=code, is_active=True)
        .select_related("category")
        .first()
    )
    if not product:
        return None

    fields = product_field_map(product)
    stock = _stock_by_warehouse(tenant_id, product.id)
    return {
        "product": {
            "id": product.id,
            "sku": product.sku,
            "name": product.name,
            "barcode": product.barcode,
            "unit_price": str(product.unit_price),
            "category": product.category.name if product.category_id else "",
            "marka": fields.get("marka", ""),
            "fields": fields,
        },
        "stock": stock,
        "suggest_transfer": stock["depo_quantity"] > 0 and stock["magaza_quantity"] == 0,
    }
