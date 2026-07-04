from __future__ import annotations

from apps.products.field_validation import serialize_field_value
from apps.products.models import Product, ProductFieldValue


def product_field_map(product: Product) -> dict[str, str]:
    """Return dynamic field key -> display string for label/lookup/TSPL."""
    values: dict[str, str] = {}
    for fv in ProductFieldValue.objects.filter(product=product).select_related("field_definition"):
        raw = serialize_field_value(fv)
        values[fv.field_definition.key] = "" if raw is None else str(raw)
    return values
