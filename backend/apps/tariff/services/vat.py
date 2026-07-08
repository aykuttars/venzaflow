from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Q
from django.utils import timezone

from apps.platform_billing.models import TaxRate, TaxType

DENTAL_VAT_TAX_CODE = "KDV10"
DEFAULT_DENTAL_VAT_PERCENT = Decimal("10")


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def dental_vat_rate_percent(for_date=None) -> Decimal:
    """Active dental (TDB) KDV rate; defaults to 10%."""
    today = for_date or timezone.localdate()
    tax_type = TaxType.objects.filter(code=DENTAL_VAT_TAX_CODE).first()
    if tax_type is None:
        return DEFAULT_DENTAL_VAT_PERCENT
    rate = (
        TaxRate.objects.filter(
            tax_type=tax_type,
            is_active=True,
            valid_from__lte=today,
        )
        .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=today))
        .order_by("-valid_from")
        .first()
    )
    if rate is None:
        return DEFAULT_DENTAL_VAT_PERCENT
    return rate.rate_percent


def incl_from_excl(excl: Decimal, rate_percent: Decimal | None = None) -> Decimal:
    rate = rate_percent if rate_percent is not None else dental_vat_rate_percent()
    multiplier = Decimal("1") + rate / Decimal("100")
    return _quantize(excl * multiplier)


def excl_from_incl(incl: Decimal, rate_percent: Decimal | None = None) -> Decimal:
    rate = rate_percent if rate_percent is not None else dental_vat_rate_percent()
    divisor = Decimal("1") + rate / Decimal("100")
    return _quantize(incl / divisor)


def sync_vat_pair(
    *,
    changed: str,
    excl: Decimal,
    incl: Decimal,
    rate_percent: Decimal | None = None,
) -> tuple[Decimal, Decimal]:
    """Return (excl, incl) with the non-changed field recalculated."""
    if changed == "excl":
        return excl, incl_from_excl(excl, rate_percent)
    if changed == "incl":
        return excl_from_incl(incl, rate_percent), incl
    raise ValueError(f"changed must be 'excl' or 'incl', got {changed!r}")
