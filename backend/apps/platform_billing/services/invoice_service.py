from __future__ import annotations

import calendar
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.platform_billing.models import (
    PlatformBillingSettings,
    TenantSubscriptionInvoice,
    TenantSubscriptionInvoiceLine,
    TenantSubscriptionPayment,
    TaxRate,
)
from apps.platform_billing.services.fx_service import convert_try_to_currency, get_latest_rate
from apps.platform_billing.services.pricing_service import (
    effective_discount_for_period,
    resolve_module_prices,
)
from apps.tenants.models import Tenant


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _registration_anchor(tenant: Tenant) -> tuple[int, int]:
    """Month and day (capped at 28) from tenant registration date."""
    anchor = timezone.localtime(tenant.created_at).date()
    return anchor.month, min(anchor.day, 28)


def _safe_anchor_date(year: int, month: int, day: int) -> date:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last_day))


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    return _safe_anchor_date(year, month, d.day)


def _add_years(d: date, years: int) -> date:
    return _safe_anchor_date(d.year + years, d.month, d.day)


def billing_period_dates(tenant: Tenant, *, reference: date | None = None) -> tuple[date, date]:
    """
    Billing window anchored to tenant registration (created_at): +1 month or +1 year.
    """
    ref = reference or timezone.localdate()
    anchor_month, anchor_day = _registration_anchor(tenant)
    period_start_candidate = _safe_anchor_date(ref.year, anchor_month, anchor_day)

    if tenant.billing_period == Tenant.BillingPeriod.YEARLY:
        if ref < period_start_candidate:
            start = _add_years(period_start_candidate, -1)
        else:
            start = period_start_candidate
        end = _add_years(start, 1) - timedelta(days=1)
        return start, end

    if ref < period_start_candidate:
        start = _add_months(period_start_candidate, -1)
    else:
        start = period_start_candidate
    end = _add_months(start, 1) - timedelta(days=1)
    return start, end


def active_tax_rates(for_date: date | None = None) -> list[TaxRate]:
    d = for_date or timezone.localdate()
    qs = TaxRate.objects.filter(is_active=True, valid_from__lte=d).select_related("tax_type")
    return [r for r in qs if r.valid_to is None or r.valid_to >= d]


def compute_tax_lines(subtotal: Decimal, for_date: date | None = None) -> tuple[list[dict], Decimal]:
    lines: list[dict] = []
    total_tax = Decimal("0")
    base = subtotal
    for rate in active_tax_rates(for_date):
        tax_amount = _quantize_money(base * rate.rate_percent / Decimal("100"))
        lines.append(
            {
                "tax_type_code": rate.tax_type.code,
                "tax_type_name": rate.tax_type.name,
                "rate_percent": str(rate.rate_percent),
                "base_amount": str(_quantize_money(base)),
                "tax_amount": str(tax_amount),
            }
        )
        total_tax += tax_amount
    return lines, total_tax


def current_billing_period_invoice(
    tenant: Tenant,
    *,
    reference: date | None = None,
) -> TenantSubscriptionInvoice | None:
    """Non-cancelled invoice for the tenant's current billing window, if any."""
    p_start, p_end = billing_period_dates(tenant, reference=reference)
    return (
        TenantSubscriptionInvoice.objects.filter(
            tenant=tenant,
            period_start=p_start,
            period_end=p_end,
        )
        .exclude(status=TenantSubscriptionInvoice.Status.CANCELLED)
        .order_by("-created_at")
        .first()
    )


def can_generate_subscription_invoice(tenant: Tenant, *, reference: date | None = None) -> bool:
    return current_billing_period_invoice(tenant, reference=reference) is None


def invoice_generation_status(
    tenant: Tenant,
    *,
    reference: date | None = None,
) -> dict:
    p_start, p_end = billing_period_dates(tenant, reference=reference)
    existing = current_billing_period_invoice(tenant, reference=reference)
    return {
        "can_generate": existing is None,
        "period_start": p_start,
        "period_end": p_end,
        "existing_invoice_id": existing.pk if existing else None,
        "existing_invoice_number": existing.number if existing else None,
    }


def generate_invoices_for_all_tenants(*, issue: bool = True) -> dict:
    """Create subscription invoices for tenants missing one in the current period."""
    summary = {"created": 0, "skipped": 0, "errors": []}
    tenants = Tenant.objects.filter(
        is_active=True,
        payment_currency__isnull=False,
    ).select_related("payment_currency")
    for tenant in tenants:
        if not can_generate_subscription_invoice(tenant):
            summary["skipped"] += 1
            continue
        try:
            generate_subscription_invoice(tenant, issue=issue)
            summary["created"] += 1
        except ValueError as exc:
            summary["skipped"] += 1
            summary["errors"].append(
                {"tenant_id": tenant.pk, "customer_code": tenant.customer_code, "detail": str(exc)}
            )
    return summary


def _next_invoice_number() -> str:
    settings = PlatformBillingSettings.get_solo()
    prefix = settings.invoice_prefix
    year = timezone.localdate().year
    pattern = f"{prefix}-{year}-"
    last = (
        TenantSubscriptionInvoice.objects.filter(number__startswith=pattern)
        .order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    return f"{pattern}{seq:04d}"


@transaction.atomic
def generate_subscription_invoice(
    tenant: Tenant,
    *,
    period_start: date | None = None,
    period_end: date | None = None,
    issue: bool = True,
) -> TenantSubscriptionInvoice:
    if not tenant.payment_currency_id:
        raise ValueError("Tenant has no payment currency configured.")

    p_start, p_end = billing_period_dates(tenant)
    if period_start:
        p_start = period_start
    if period_end:
        p_end = period_end

    if (
        TenantSubscriptionInvoice.objects.filter(
            tenant=tenant,
            period_start=p_start,
            period_end=p_end,
        )
        .exclude(status=TenantSubscriptionInvoice.Status.CANCELLED)
        .exists()
    ):
        raise ValueError(
            f"An invoice already exists for period {p_start} — {p_end}."
        )

    user_count = tenant.active_user_count()
    if user_count == 0:
        raise ValueError("Tenant has no active users for billing.")

    active_modules = list(
        tenant.module_subscriptions.filter(is_active=True).values_list("module_slug", flat=True)
    )
    if not active_modules:
        raise ValueError("Tenant has no active module subscriptions.")

    prices = resolve_module_prices(tenant, active_modules)

    months = 12 if tenant.billing_period == Tenant.BillingPeriod.YEARLY else 1
    is_yearly = tenant.billing_period == Tenant.BillingPeriod.YEARLY
    discount_percent = effective_discount_for_period(tenant)

    subtotal_try_before = Decimal("0")
    subtotal_try_after = Decimal("0")
    line_data: list[dict] = []

    for slug in active_modules:
        monthly = prices[slug] * user_count
        line_try_before = monthly * months
        line_try_after = line_try_before
        if discount_percent > 0:
            line_try_after = line_try_before * (Decimal("100") - discount_percent) / Decimal("100")
        subtotal_try_before += line_try_before
        subtotal_try_after += line_try_after
        line_data.append(
            {
                "module_slug": slug,
                "description": f"{slug} ({user_count} kullanıcı × {months} ay)",
                "user_count": user_count,
                "months": months,
                "line_try_before": line_try_before,
                "line_try_after": line_try_after,
            }
        )

    subtotal_try_before = _quantize_money(subtotal_try_before)
    subtotal_try_after = _quantize_money(subtotal_try_after)
    currency_code = tenant.payment_currency.code
    fx = get_latest_rate(currency_code)
    subtotal_before_currency = _quantize_money(
        convert_try_to_currency(subtotal_try_before, fx.rate_to_try)
    )
    subtotal_currency = _quantize_money(
        convert_try_to_currency(subtotal_try_after, fx.rate_to_try)
    )
    discount_amount = _quantize_money(subtotal_before_currency - subtotal_currency)

    tax_lines, total_tax = compute_tax_lines(subtotal_currency, p_end)
    total_incl = _quantize_money(subtotal_currency + total_tax)

    invoice = TenantSubscriptionInvoice.objects.create(
        tenant=tenant,
        number=_next_invoice_number(),
        period_start=p_start,
        period_end=p_end,
        billing_period=tenant.billing_period,
        currency_id=tenant.payment_currency_id,
        fx_rate_to_try=fx.rate_to_try,
        subtotal_before_discount=subtotal_before_currency,
        discount_percent=discount_percent,
        discount_amount=discount_amount if discount_percent > 0 else Decimal("0"),
        subtotal_excl_tax=subtotal_currency,
        tax_lines=tax_lines,
        total_incl_tax=total_incl,
        status=TenantSubscriptionInvoice.Status.DRAFT,
    )

    for item in line_data:
        divisor = item["user_count"] * item["months"]
        unit_list = _quantize_money(
            convert_try_to_currency(item["line_try_before"] / divisor, fx.rate_to_try)
        )
        unit_net = _quantize_money(
            convert_try_to_currency(item["line_try_after"] / divisor, fx.rate_to_try)
        )
        line_before = _quantize_money(
            convert_try_to_currency(item["line_try_before"], fx.rate_to_try)
        )
        line_after = _quantize_money(
            convert_try_to_currency(item["line_try_after"], fx.rate_to_try)
        )
        TenantSubscriptionInvoiceLine.objects.create(
            invoice=invoice,
            module_slug=item["module_slug"],
            description=item["description"],
            user_count=item["user_count"],
            unit_price_list=unit_list,
            discount_percent=discount_percent,
            unit_price=unit_net,
            months=item["months"],
            line_total_before_discount=line_before,
            amount_excl_tax=line_after,
        )

    if issue:
        issue_invoice(invoice)
    return invoice


def issue_invoice(invoice: TenantSubscriptionInvoice) -> TenantSubscriptionInvoice:
    if invoice.status != TenantSubscriptionInvoice.Status.DRAFT:
        return invoice
    invoice.status = TenantSubscriptionInvoice.Status.ISSUED
    invoice.issued_at = timezone.now()
    invoice.save(update_fields=["status", "issued_at", "updated_at"])
    return invoice


@transaction.atomic
def mark_invoice_paid(
    invoice: TenantSubscriptionInvoice,
    *,
    method: str = "bank_transfer",
    reference: str = "",
) -> TenantSubscriptionInvoice:
    if invoice.status == TenantSubscriptionInvoice.Status.CANCELLED:
        raise ValueError("Cannot pay a cancelled invoice.")
    now = timezone.now()
    invoice.status = TenantSubscriptionInvoice.Status.PAID
    invoice.paid_at = now
    update_fields = ["status", "paid_at", "updated_at"]
    if not invoice.issued_at:
        invoice.issued_at = now
        update_fields.append("issued_at")
    invoice.save(update_fields=update_fields)
    TenantSubscriptionPayment.objects.create(
        invoice=invoice,
        amount=invoice.total_incl_tax,
        paid_at=now,
        method=method,
        reference=reference,
    )
    return invoice
