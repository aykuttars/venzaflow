from __future__ import annotations

from typing import Any

from apps.barcode.models import BarcodeSettings, LabelTemplate
from apps.inventory.models import Location, Warehouse
from apps.products.models import Product


def _template_summary(template: LabelTemplate) -> dict[str, Any]:
    return {
        "id": template.id,
        "name": template.name,
        "width_mm": str(template.width_mm),
        "height_mm": str(template.height_mm),
    }


def _first_allowed_template(tenant_id: int, department_key: str | None) -> LabelTemplate | None:
    qs = LabelTemplate.objects.filter(tenant_id=tenant_id, is_active=True).order_by("id")
    if not department_key:
        return qs.first()
    for tpl in qs:
        keys = tpl.allowed_department_keys or []
        if not keys or department_key in keys:
            return tpl
    return None


def resolve_label_template(
    tenant_id: int,
    *,
    product_id: int | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    department_key: str | None = None,
) -> tuple[LabelTemplate | None, str]:
    """
    Priority: product → location → warehouse → tenant default → first allowed template.
    Returns (template, source_key).
    """
    if product_id:
        product = (
            Product.objects.filter(tenant_id=tenant_id, pk=product_id, is_active=True)
            .select_related("label_template")
            .first()
        )
        if product and product.label_template_id and product.label_template.is_active:
            return product.label_template, "product"

    if location_id:
        location = (
            Location.objects.filter(tenant_id=tenant_id, pk=location_id, is_active=True)
            .select_related("label_template")
            .first()
        )
        if location and location.label_template_id and location.label_template.is_active:
            return location.label_template, "location"

    if warehouse_id:
        warehouse = (
            Warehouse.objects.filter(tenant_id=tenant_id, pk=warehouse_id, is_active=True)
            .select_related("label_template")
            .first()
        )
        if warehouse and warehouse.label_template_id and warehouse.label_template.is_active:
            return warehouse.label_template, "warehouse"

    settings = (
        BarcodeSettings.objects.filter(tenant_id=tenant_id)
        .select_related("default_label_template")
        .first()
    )
    if (
        settings
        and settings.default_label_template_id
        and settings.default_label_template.is_active
    ):
        return settings.default_label_template, "tenant_default"

    fallback = _first_allowed_template(tenant_id, department_key)
    if fallback:
        return fallback, "fallback"
    return None, "none"


def resolve_label_template_payload(
    tenant_id: int,
    *,
    product_id: int | None = None,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    department_key: str | None = None,
) -> dict[str, Any]:
    template, source = resolve_label_template(
        tenant_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        location_id=location_id,
        department_key=department_key,
    )
    if not template:
        return {"template": None, "source": source}
    return {"template": _template_summary(template), "source": source}
