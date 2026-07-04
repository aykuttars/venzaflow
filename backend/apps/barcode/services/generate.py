from __future__ import annotations

import random

from django.db import transaction

from apps.barcode.models import BarcodeAssignment
from apps.barcode.services.settings import get_or_create_settings
from apps.products.models import Product


def _ean13_checksum(first12: str) -> str:
    digits = [int(c) for c in first12]
    total = sum(digits[::2]) + sum(d * 3 for d in digits[1::2])
    check = (10 - (total % 10)) % 10
    return str(check)


def generate_ean13(prefix: str = "869") -> str:
    """Generate a valid EAN-13 with given 3-digit prefix."""
    body = prefix + "".join(str(random.randint(0, 9)) for _ in range(9))
    return body + _ean13_checksum(body)


@transaction.atomic
def generate_missing_barcodes(
    tenant_id: int, *, limit: int = 100, product_id: int | None = None
) -> dict:
    settings = get_or_create_settings(tenant_id)
    prefix = (settings.ean_prefix or "869")[:3]
    qs = Product.objects.filter(tenant_id=tenant_id, barcode="", is_active=True)
    if product_id:
        qs = qs.filter(pk=product_id)
    products = list(qs.order_by("id")[:limit])
    existing = set(
        Product.objects.filter(tenant_id=tenant_id)
        .exclude(barcode="")
        .values_list("barcode", flat=True)
    )
    updated = 0
    for product in products:
        for _ in range(20):
            candidate = generate_ean13(prefix)
            if candidate not in existing:
                product.barcode = candidate
                product.save(update_fields=["barcode"])
                BarcodeAssignment.objects.update_or_create(
                    tenant_id=tenant_id,
                    product=product,
                    defaults={"symbology": "EAN13"},
                )
                existing.add(candidate)
                updated += 1
                break
    return {"generated": updated, "remaining": max(0, len(products) - updated)}
