from __future__ import annotations


def build_qr_payload(
    *,
    mode: str,
    max_length: int,
    product: dict,
) -> str:
    barcode = (product.get("barcode") or "").strip()
    sku = (product.get("sku") or "").strip()
    name = (product.get("name") or "").strip()

    if mode == "sku":
        payload = sku or barcode
    elif mode == "compact_detail":
        parts = [p for p in [name, sku, barcode] if p]
        payload = " | ".join(parts)
    else:
        payload = barcode or sku

    if len(payload) > max_length:
        payload = payload[: max_length - 1] + "…"
    return payload
