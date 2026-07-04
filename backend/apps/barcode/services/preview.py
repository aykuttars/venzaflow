from __future__ import annotations

import io
import math
from decimal import Decimal
from typing import Any

from PIL import Image, ImageDraw, ImageFont

from apps.barcode.services.lookup import lookup_barcode
from apps.products.models import Product, ProductFieldValue


def _resolve_binding(product: Product, binding: str, fields: dict[str, str]) -> str:
    if not binding:
        return ""
    if binding.startswith("product."):
        key = binding.split(".", 1)[1]
        if key == "price":
            return f"{product.unit_price:.2f} ₺"
        if key == "marka":
            return fields.get("marka", "")
        if hasattr(product, key):
            val = getattr(product, key)
            return "" if val is None else str(val)
    return binding


def _product_context(tenant_id: int, product_id: int | None) -> tuple[Product | None, dict[str, str]]:
    if not product_id:
        return None, {}
    product = Product.objects.filter(tenant_id=tenant_id, pk=product_id).first()
    if not product:
        return None, {}
    fields = {
        fv.field_definition.key: fv.value or ""
        for fv in ProductFieldValue.objects.filter(product=product).select_related(
            "field_definition"
        )
    }
    return product, fields


def _mm_to_px(mm: float, dpi: int) -> int:
    return max(1, int(round(float(mm) / 25.4 * dpi)))


def _draw_barcode_placeholder(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    w: int,
    h: int,
    text: str,
    rotation: int,
) -> None:
    if rotation in (90, 270):
        draw.rectangle([x, y, x + h, y + w], outline="black", width=1)
        draw.text((x + 2, y + 2), text[:20], fill="black")
    else:
        draw.rectangle([x, y, x + w, y + h], outline="black", width=1)
        draw.text((x + 2, y + 2), text[:20], fill="black")


def render_label_png(
    *,
    width_mm: Decimal,
    height_mm: Decimal,
    dpi: int,
    layout_json: list[dict],
    tenant_id: int,
    product_id: int | None = None,
) -> bytes:
    w_px = _mm_to_px(float(width_mm), dpi)
    h_px = _mm_to_px(float(height_mm), dpi)
    img = Image.new("RGB", (w_px, h_px), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 12)
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    except OSError:
        font = ImageFont.load_default()
        font_sm = font

    product, fields = _product_context(tenant_id, product_id)
    scale = dpi / 203.0

    for elem in layout_json:
        ex = _mm_to_px(elem.get("x", 0) * scale, dpi)
        ey = _mm_to_px(elem.get("y", 0) * scale, dpi)
        ew = _mm_to_px(elem.get("width", 10) * scale, dpi)
        eh = _mm_to_px(elem.get("height", 5) * scale, dpi)
        rotation = int(elem.get("rotation", 0))
        etype = elem.get("type", "text")

        if etype == "text":
            text = elem.get("static_text") or ""
            if product and elem.get("data_binding"):
                text = _resolve_binding(product, elem["data_binding"], fields)
            fsize = int(elem.get("font_size", 10) * scale)
            try:
                fnt = ImageFont.truetype(
                    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
                    if elem.get("font_bold")
                    else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                    max(8, fsize),
                )
            except OSError:
                fnt = font_sm
            if rotation == 90:
                sub = Image.new("RGB", (eh, ew), "white")
                sd = ImageDraw.Draw(sub)
                sd.text((2, 2), text, fill="black", font=fnt)
                sub = sub.rotate(90, expand=True)
                img.paste(sub, (ex, ey))
            elif rotation == 270:
                sub = Image.new("RGB", (eh, ew), "white")
                sd = ImageDraw.Draw(sub)
                sd.text((2, 2), text, fill="black", font=fnt)
                sub = sub.rotate(270, expand=True)
                img.paste(sub, (ex, ey))
            elif rotation == 180:
                sub = Image.new("RGB", (ew, eh), "white")
                sd = ImageDraw.Draw(sub)
                sd.text((2, 2), text, fill="black", font=fnt)
                sub = sub.rotate(180, expand=True)
                img.paste(sub, (ex, ey))
            else:
                draw.text((ex, ey), text, fill="black", font=fnt)
        elif etype == "barcode_1d":
            val = ""
            if product and elem.get("data_binding"):
                val = _resolve_binding(product, elem["data_binding"], fields)
            _draw_barcode_placeholder(draw, ex, ey, ew, eh, val or "BARCODE", rotation)
        elif etype == "qr":
            val = ""
            if product and elem.get("data_binding"):
                val = _resolve_binding(product, elem["data_binding"], fields)
            size = min(ew, eh)
            draw.rectangle([ex, ey, ex + size, ey + size], outline="black", width=1)
            draw.text((ex + 2, ey + 2), "QR", fill="black", font=font_sm)
            if val:
                draw.text((ex + 2, ey + size - 12), val[:8], fill="black", font=font_sm)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
