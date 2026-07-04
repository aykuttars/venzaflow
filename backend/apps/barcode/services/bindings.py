from __future__ import annotations

from django.utils import timezone

from apps.products.models import Product, ProductFieldDefinition

CORE_BINDINGS: list[tuple[str, str]] = [
    ("product.name", "Ürün adı"),
    ("product.sku", "SKU"),
    ("product.barcode", "Barkod numarası"),
    ("product.price", "Satış fiyatı"),
    ("product.cost_price", "Maliyet fiyatı"),
    ("product.category", "Kategori"),
]

LABEL_BINDINGS: list[tuple[str, str]] = [
    ("label.print_date", "Etiket tarihi"),
    ("label.print_datetime", "Etiket tarih/saat"),
]

TICKET_BINDINGS: list[tuple[str, str]] = [
    ("ticket.number", "Kayıt no"),
    ("ticket.customer_name", "Müşteri adı"),
    ("ticket.customer_phone", "Telefon"),
    ("ticket.device", "Cihaz"),
    ("ticket.device_serial", "Seri no"),
    ("ticket.complaint_short", "Şikayet"),
    ("ticket.received_date", "Teslim tarihi"),
    ("ticket.received_datetime", "Teslim tarih/saat"),
    ("ticket.copy_label", "Nüsha etiketi"),
    ("ticket.qr", "Kayıt QR/barkod"),
]


def list_binding_fields(tenant_id: int) -> list[dict]:
    """Catalog of bindable fields for label designer (tenant-aware)."""
    items = [
        {"binding": b, "label": label, "group": "core", "element_type": _suggest_type(b)}
        for b, label in CORE_BINDINGS
    ]
    for definition in ProductFieldDefinition.objects.filter(tenant_id=tenant_id, is_active=True).order_by(
        "form_order", "key"
    ):
        items.append(
            {
                "binding": f"product.field.{definition.key}",
                "label": definition.label,
                "group": "dynamic",
                "element_type": "text",
            }
        )
    items.extend(
        {
            "binding": b,
            "label": label,
            "group": "label",
            "element_type": "text",
        }
        for b, label in LABEL_BINDINGS
    )
    items.extend(
        {
            "binding": b,
            "label": label,
            "group": "service",
            "element_type": "barcode_1d" if b == "ticket.qr" else "text",
        }
        for b, label in TICKET_BINDINGS
    )
    return items


def _suggest_type(binding: str) -> str:
    if binding in ("product.barcode", "ticket.qr"):
        return "barcode_1d"
    return "text"


def resolve_binding(
    product: Product | None,
    binding: str,
    fields: dict[str, str],
    *,
    category_name: str = "",
) -> str:
    if not binding:
        return ""
    if binding.startswith("label."):
        key = binding.split(".", 1)[1]
        now = timezone.localtime()
        if key == "print_date":
            return now.strftime("%d.%m.%Y")
        if key == "print_datetime":
            return now.strftime("%d.%m.%Y %H:%M")
        return ""
    if binding.startswith("product.field."):
        field_key = binding.split(".", 2)[2]
        return fields.get(field_key, "")
    if binding.startswith("product."):
        if not product:
            return ""
        key = binding.split(".", 1)[1]
        if key == "price":
            return f"{product.unit_price:.2f} ₺"
        if key == "cost_price":
            return f"{product.cost_price:.2f} ₺" if product.cost_price is not None else ""
        if key == "category":
            return category_name
        if key in fields:
            return fields[key]
        if hasattr(product, key):
            val = getattr(product, key)
            return "" if val is None else str(val)
    return binding


def resolve_ticket_binding(binding: str, snapshot: dict[str, str]) -> str:
    if not binding:
        return ""
    if binding.startswith("label."):
        key = binding.split(".", 1)[1]
        now = timezone.localtime()
        if key == "print_date":
            return now.strftime("%d.%m.%Y")
        if key == "print_datetime":
            return now.strftime("%d.%m.%Y %H:%M")
        return ""
    if binding.startswith("ticket."):
        key = binding.split(".", 1)[1]
        return str(snapshot.get(key, "") or "")
    return binding
