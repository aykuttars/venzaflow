from __future__ import annotations

from decimal import Decimal
from typing import Any

from apps.barcode.services.bindings import resolve_binding, resolve_ticket_binding
from apps.barcode.services.product_fields import product_field_map
from apps.products.models import Product


def _dots(mm: float, dpi: int = 203) -> int:
    return max(1, int(round(float(mm) / 25.4 * dpi)))


def _rotation_tspl(rotation: int) -> int:
    r = int(rotation) % 360
    if r in (0, 90, 180, 270):
        return r
    return 0


def render_tspl_for_product(
    *,
    template_snapshot: dict[str, Any],
    layout_json: list[dict],
    product: Product,
    copies: int = 1,
) -> str:
    width = float(template_snapshot.get("width_mm", 40))
    height = float(template_snapshot.get("height_mm", 30))
    gap = float(template_snapshot.get("gap_mm", 2))
    dpi = int(template_snapshot.get("dpi", 203))

    fields = product_field_map(product)
    category_name = product.category.name if product.category_id else ""

    lines = [
        f"SIZE {width:.2f} mm,{height:.2f} mm",
        f"GAP {gap:.2f} mm,0 mm",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CLS",
    ]

    for elem in layout_json:
        etype = elem.get("type", "text")
        x = _dots(elem.get("x", 0), dpi)
        y = _dots(elem.get("y", 0), dpi)
        rotation = _rotation_tspl(int(elem.get("rotation", 0)))

        if etype == "text":
            text = elem.get("static_text") or ""
            if elem.get("data_binding"):
                text = resolve_binding(product, elem["data_binding"], fields, category_name=category_name)
            text = text.replace('"', "'")
            font_h = max(12, int(elem.get("font_size", 10) * dpi / 72))
            lines.append(f'TEXT {x},{y},"0",{rotation},{font_h},{font_h},"{text}"')
        elif etype == "barcode_1d":
            val = ""
            if elem.get("data_binding"):
                val = resolve_binding(product, elem["data_binding"], fields, category_name=category_name)
            sym = elem.get("symbology", "128")
            bar_type = "128" if sym == "CODE128" else "EAN13" if sym == "EAN13" else "128"
            h = _dots(elem.get("height", 10), dpi)
            readable = 1 if elem.get("show_text", True) else 0
            lines.append(
                f'BARCODE {x},{y},"{bar_type}",{h},{readable},0,{rotation},2,4,"{val}"'
            )
        elif etype == "qr":
            val = ""
            if elem.get("data_binding"):
                val = resolve_binding(product, elem["data_binding"], fields, category_name=category_name)
            cell = max(2, int(_dots(elem.get("width", 8), dpi) / 20))
            lines.append(f'QRCODE {x},{y},H,{cell},A,{rotation},"{val}"')

    lines.append(f"PRINT {copies},1")
    return "\r\n".join(lines) + "\r\n"


def render_tspl_for_ticket(
    *,
    template_snapshot: dict[str, Any],
    layout_json: list[dict],
    ticket_snapshot: dict[str, Any],
    copies: int = 1,
) -> str:
    width = float(template_snapshot.get("width_mm", 80))
    height = float(template_snapshot.get("height_mm", 50))
    gap = float(template_snapshot.get("gap_mm", 2))
    dpi = int(template_snapshot.get("dpi", 203))
    snap = {k: str(v) for k, v in ticket_snapshot.items()}

    lines = [
        f"SIZE {width:.2f} mm,{height:.2f} mm",
        f"GAP {gap:.2f} mm,0 mm",
        "DIRECTION 1",
        "REFERENCE 0,0",
        "CLS",
    ]

    for elem in layout_json:
        etype = elem.get("type", "text")
        x = _dots(elem.get("x", 0), dpi)
        y = _dots(elem.get("y", 0), dpi)
        rotation = _rotation_tspl(int(elem.get("rotation", 0)))

        if etype == "text":
            text = elem.get("static_text") or ""
            if elem.get("data_binding"):
                text = resolve_ticket_binding(elem["data_binding"], snap)
            text = text.replace('"', "'")
            font_h = max(12, int(elem.get("font_size", 10) * dpi / 72))
            lines.append(f'TEXT {x},{y},"0",{rotation},{font_h},{font_h},"{text}"')
        elif etype == "barcode_1d":
            val = ""
            if elem.get("data_binding"):
                val = resolve_ticket_binding(elem["data_binding"], snap)
            sym = elem.get("symbology", "128")
            bar_type = "128" if sym == "CODE128" else "EAN13" if sym == "EAN13" else "128"
            h = _dots(elem.get("height", 10), dpi)
            readable = 1 if elem.get("show_text", True) else 0
            lines.append(
                f'BARCODE {x},{y},"{bar_type}",{h},{readable},0,{rotation},2,4,"{val}"'
            )
        elif etype == "qr":
            val = ""
            if elem.get("data_binding"):
                val = resolve_ticket_binding(elem["data_binding"], snap)
            cell = max(2, int(_dots(elem.get("width", 8), dpi) / 20))
            lines.append(f'QRCODE {x},{y},H,{cell},A,{rotation},"{val}"')

    lines.append(f"PRINT {copies},1")
    return "\r\n".join(lines) + "\r\n"


def render_tspl_for_job(
    *,
    template_snapshot: dict[str, Any],
    layout_json: list[dict],
    products: list[Product],
    ticket_snapshot: dict[str, Any] | None,
    copies: int = 1,
) -> str:
    if ticket_snapshot:
        return render_tspl_for_ticket(
            template_snapshot=template_snapshot,
            layout_json=layout_json,
            ticket_snapshot=ticket_snapshot,
            copies=copies,
        )
    if products:
        return render_tspl_for_product(
            template_snapshot=template_snapshot,
            layout_json=layout_json,
            product=products[0],
            copies=copies,
        )
    return ""


def render_tspl_batch(
    *,
    template_snapshot: dict[str, Any],
    layout_json: list[dict],
    products: list[Product],
    copies: int = 1,
) -> str:
    chunks = [
        render_tspl_for_product(
            template_snapshot=template_snapshot,
            layout_json=layout_json,
            product=p,
            copies=copies,
        )
        for p in products
    ]
    return "\r\n".join(chunks)
