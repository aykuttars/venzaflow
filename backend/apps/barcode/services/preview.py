from __future__ import annotations

import io
import math
from decimal import Decimal
from typing import Any

import qrcode
from PIL import Image, ImageDraw, ImageFont

from apps.barcode.models import BarcodeSettings
from apps.barcode.services.bindings import resolve_binding
from apps.barcode.services.product_fields import product_field_map
from apps.barcode.services.qr_payload import build_qr_payload
from apps.barcode.vendor_barcode import import_image_writer, import_vendor_barcode
from apps.products.models import Product


def _product_context(tenant_id: int, product_id: int | None) -> tuple[Product | None, dict[str, str], str]:
    if not product_id:
        return None, {}, ""
    product = (
        Product.objects.filter(tenant_id=tenant_id, pk=product_id).select_related("category").first()
    )
    if not product:
        return None, {}, ""
    category_name = product.category.name if product.category_id else ""
    return product, product_field_map(product), category_name


def resolve_preview_product_id(tenant_id: int, product_id: int | None) -> int | None:
    """Use explicit product when provided; otherwise first tenant product for designer preview."""
    if product_id:
        if Product.objects.filter(tenant_id=tenant_id, pk=product_id).exists():
            return product_id
        return None
    return Product.objects.filter(tenant_id=tenant_id).order_by("pk").values_list("pk", flat=True).first()


def _mm_to_px(mm: float, dpi: int) -> int:
    return max(1, int(round(float(mm) / 25.4 * dpi)))


def _rotation_bounds(w: int, h: int, angle_deg: float) -> tuple[int, int]:
    rad = math.radians(angle_deg % 360)
    cos_a = abs(math.cos(rad))
    sin_a = abs(math.sin(rad))
    return int(w * cos_a + h * sin_a), int(w * sin_a + h * cos_a)


def validate_layout_bounds(
    *,
    width_mm: Decimal,
    height_mm: Decimal,
    dpi: int,
    layout_json: list[dict],
) -> list[str]:
    warnings: list[str] = []
    w_px = _mm_to_px(float(width_mm), dpi)
    h_px = _mm_to_px(float(height_mm), dpi)
    for elem in layout_json:
        ex = _mm_to_px(elem.get("x", 0), dpi)
        ey = _mm_to_px(elem.get("y", 0), dpi)
        ew = _mm_to_px(elem.get("width", 10), dpi)
        eh = _mm_to_px(elem.get("height", 5), dpi)
        rotation = float(elem.get("rotation", 0))
        bw, bh = _rotation_bounds(ew, eh, rotation)
        if ex + bw > w_px or ey + bh > h_px or ex < 0 or ey < 0:
            warnings.append(f"Element {elem.get('id', '?')} exceeds label bounds.")
    if float(width_mm) < 30 or float(width_mm) > 80:
        warnings.append("Label width should be between 30–80 mm for XP-P328B.")
    return warnings


def _paste_rotated(base: Image.Image, overlay: Image.Image, x: int, y: int, angle: float) -> None:
    if angle % 360 == 0:
        base.paste(overlay, (x, y))
        return
    rotated = overlay.rotate(-angle, expand=True, fillcolor="white")
    base.paste(rotated, (x, y))


def _render_barcode_block(
    value: str,
    symbology: str,
    width_px: int,
    height_px: int,
    *,
    show_text: bool,
    font,
) -> Image.Image:
    if show_text and value:
        bar_h = max(1, int(height_px * 0.72))
        text_h = height_px - bar_h
        bar_img = _render_barcode_image(value, symbology, width_px, bar_h)
        sub = Image.new("RGB", (width_px, height_px), "white")
        sub.paste(bar_img, (0, 0))
        if text_h > 0:
            sd = ImageDraw.Draw(sub)
            display = value
            try:
                bbox = sd.textbbox((0, 0), display, font=font)
                tw = bbox[2] - bbox[0]
            except AttributeError:
                tw = len(display) * 6
            tx = max(0, (width_px - tw) // 2)
            ty = bar_h + max(0, (text_h - 10) // 2)
            sd.text((tx, ty), display, fill="black", font=font)
        return sub
    return _render_barcode_image(value, symbology, width_px, height_px)


def _render_barcode_image(value: str, symbology: str, width_px: int, height_px: int) -> Image.Image:
    if not value:
        value = "0000000000000"
    try:
        vendor_barcode = import_vendor_barcode()
        image_writer = import_image_writer()
        if symbology == "EAN13" and len(value) == 13 and value.isdigit():
            code = vendor_barcode.get("ean13", value, writer=image_writer())
        else:
            code = vendor_barcode.get("code128", value, writer=image_writer())
        buf = io.BytesIO()
        code.write(
            buf,
            options={
                "module_width": 0.2,
                "module_height": max(5.0, height_px / 8),
                "quiet_zone": 1.0,
                "write_text": False,
            },
        )
        buf.seek(0)
        img = Image.open(buf).convert("RGB")
        img = img.resize((max(1, width_px), max(1, height_px)), Image.Resampling.LANCZOS)
        return img
    except Exception:
        img = Image.new("RGB", (width_px, height_px), "white")
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, 0, width_px - 1, height_px - 1], outline="black")
        draw.text((2, 2), value[:16], fill="black")
        return img


def _render_qr_image(payload: str, size_px: int) -> Image.Image:
    qr = qrcode.QRCode(box_size=2, border=1)
    qr.add_data(payload or " ")
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    return img.resize((size_px, size_px), Image.Resampling.NEAREST)


def render_label_png(
    *,
    width_mm: Decimal,
    height_mm: Decimal,
    dpi: int,
    layout_json: list[dict],
    tenant_id: int,
    product_id: int | None = None,
    settings: BarcodeSettings | None = None,
) -> bytes:
    w_px = _mm_to_px(float(width_mm), dpi)
    h_px = _mm_to_px(float(height_mm), dpi)
    img = Image.new("RGB", (w_px, h_px), "white")
    draw = ImageDraw.Draw(img)
    try:
        font_sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
    except OSError:
        font_sm = ImageFont.load_default()

    product, fields, category_name = _product_context(tenant_id, product_id)
    scale = dpi / 203.0
    logo_img = None
    if settings and settings.label_logo:
        try:
            logo_img = Image.open(settings.label_logo.path).convert("RGBA")
        except OSError:
            logo_img = None

    for elem in layout_json:
        ex = _mm_to_px(elem.get("x", 0) * scale, dpi)
        ey = _mm_to_px(elem.get("y", 0) * scale, dpi)
        ew = _mm_to_px(elem.get("width", 10) * scale, dpi)
        eh = _mm_to_px(elem.get("height", 5) * scale, dpi)
        rotation = float(elem.get("rotation", 0))
        etype = elem.get("type", "text")

        if etype == "image" and logo_img is not None:
            logo = logo_img.copy()
            logo.thumbnail((ew, eh), Image.Resampling.LANCZOS)
            sub = Image.new("RGB", (ew, eh), "white")
            sub.paste(logo, (0, 0), logo if logo.mode == "RGBA" else None)
            _paste_rotated(img, sub, ex, ey, rotation)
        elif etype == "text":
            text = elem.get("static_text") or ""
            if product and elem.get("data_binding"):
                text = resolve_binding(product, elem["data_binding"], fields, category_name=category_name)
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
            sub = Image.new("RGB", (ew, eh), "white")
            sd = ImageDraw.Draw(sub)
            sd.text((2, 2), text, fill="black", font=fnt)
            _paste_rotated(img, sub, ex, ey, rotation)
        elif etype == "barcode_1d":
            val = ""
            if product and elem.get("data_binding"):
                val = resolve_binding(product, elem["data_binding"], fields, category_name=category_name)
            sym = elem.get("symbology", "EAN13")
            sub = _render_barcode_block(
                val,
                sym,
                ew,
                eh,
                show_text=bool(elem.get("show_text")),
                font=font_sm,
            )
            _paste_rotated(img, sub, ex, ey, rotation)
        elif etype == "qr":
            if product and settings:
                payload = build_qr_payload(
                    mode=settings.qr_content_mode,
                    max_length=settings.qr_max_length,
                    product={
                        "barcode": product.barcode,
                        "sku": product.sku,
                        "name": product.name,
                    },
                )
            elif product and elem.get("data_binding"):
                payload = resolve_binding(product, elem["data_binding"], fields, category_name=category_name)
            else:
                payload = ""
            size = min(ew, eh)
            sub = _render_qr_image(payload, size)
            _paste_rotated(img, sub, ex, ey, rotation)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
