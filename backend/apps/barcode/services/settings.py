from __future__ import annotations

from apps.barcode.models import BarcodeSettings
from apps.barcode.services.settings_defaults import DEFAULT_OPERATION_FLAGS, DEFAULT_PRINTER_PROFILE


def get_or_create_settings(tenant_id: int) -> BarcodeSettings:
    settings, _ = BarcodeSettings.objects.get_or_create(
        tenant_id=tenant_id,
        defaults={
            "operation_flags": dict(DEFAULT_OPERATION_FLAGS),
            "printer_profile_json": dict(DEFAULT_PRINTER_PROFILE),
        },
    )
    return settings


def effective_settings_payload(settings: BarcodeSettings) -> dict:
    profile = {**DEFAULT_PRINTER_PROFILE, **(settings.printer_profile_json or {})}
    return {
        "scan_miss_action": settings.scan_miss_action,
        "normalize_tr_scan": settings.normalize_tr_scan,
        "qr_content_mode": settings.qr_content_mode,
        "qr_max_length": settings.qr_max_length,
        "ean_prefix": settings.ean_prefix,
        "auto_generate_on_create": settings.auto_generate_on_create,
        "operation_flags": settings.operation_flags or DEFAULT_OPERATION_FLAGS,
        "stock_deduction_mode": settings.stock_deduction_mode,
        "print_mode": settings.print_mode,
        "default_copies": settings.default_copies,
        "default_transfer_qty": settings.default_transfer_qty,
        "printer_model": settings.printer_model,
        "printer_profile": profile,
        "label_logo_url": settings.label_logo.url if settings.label_logo else None,
    }
