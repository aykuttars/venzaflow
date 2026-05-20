from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.platform_billing.models import Currency, ExchangeRate


def get_latest_rate(currency_code: str) -> ExchangeRate:
    if currency_code == "TRY":
        currency, _ = Currency.objects.get_or_create(
            code="TRY",
            defaults={"name": "Turkish Lira", "symbol": "₺", "decimal_places": 2},
        )
        now = timezone.now()
        rate, created = ExchangeRate.objects.get_or_create(
            currency=currency,
            source=ExchangeRate.Source.MANUAL,
            fetched_at=now,
            defaults={"rate_to_try": Decimal("1")},
        )
        if not created:
            rate.rate_to_try = Decimal("1")
            rate.save(update_fields=["rate_to_try"])
        return rate

    currency = Currency.objects.get(code=currency_code, is_active=True)
    rate = (
        ExchangeRate.objects.filter(currency=currency)
        .order_by("-fetched_at")
        .first()
    )
    if not rate:
        raise ValueError(f"No exchange rate for {currency_code}. Set a manual rate.")
    return rate


def convert_try_to_currency(amount_try: Decimal, rate_to_try: Decimal) -> Decimal:
    if rate_to_try <= 0:
        raise ValueError("Invalid exchange rate.")
    return (amount_try / rate_to_try).quantize(Decimal("0.0001"))


def save_manual_rate(currency_code: str, rate_to_try: Decimal) -> ExchangeRate:
    currency = Currency.objects.get(code=currency_code)
    return ExchangeRate.objects.create(
        currency=currency,
        rate_to_try=rate_to_try,
        source=ExchangeRate.Source.MANUAL,
        fetched_at=timezone.now(),
    )


def persist_tcmb_rates(rates: dict[str, Decimal]) -> int:
    """Persist TCMB rates for currencies that have tcmb_code set."""
    count = 0
    now = timezone.now()
    for currency in Currency.objects.filter(is_active=True).exclude(tcmb_code="").exclude(
        tcmb_code__isnull=True
    ):
        rate = rates.get(currency.tcmb_code) or rates.get(currency.code)
        if rate is None:
            continue
        ExchangeRate.objects.create(
            currency=currency,
            rate_to_try=rate,
            source=ExchangeRate.Source.TCMB,
            fetched_at=now,
        )
        count += 1
    return count
