from __future__ import annotations

from django.db.models import Q, QuerySet

from apps.products.models import Product

ORAL_PRODUCT_CATEGORY_SLUG = "oral-hizmetleri"


def is_oral_procedure_product(product: Product) -> bool:
    if product.oral_procedures.exists():
        return True
    return bool(product.category and product.category.slug == ORAL_PRODUCT_CATEGORY_SLUG)


def exclude_oral_procedure_products(qs: QuerySet[Product]) -> QuerySet[Product]:
    """Products catalog UI: oral procedure mirrors live in the Oral module."""
    return qs.exclude(
        Q(oral_procedures__isnull=False) | Q(category__slug=ORAL_PRODUCT_CATEGORY_SLUG)
    ).distinct()
