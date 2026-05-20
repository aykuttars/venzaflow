from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone

from apps.platform_billing.models import (
    ModulePrice,
    PlatformBillingSettings,
    TenantSubscriptionInvoice,
    TenantSubscriptionInvoiceLine,
    TenantSubscriptionPayment,
    TaxRate,
)
from apps.platform_billing.services.fx_service import convert_try_to_currency, get_latest_rate
from apps.tenants.models import Tenant


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def effective_yearly_discount(tenant: Tenant) -> Decimal:
    if tenant.yearly_discount_percent is not None:
        return tenant.yearly_discount_percent
    return PlatformBillingSettings.get_solo().yearly_discount_percent


def billing_period_dates(tenant: Tenant, *, reference: date | None = None) -> tuple[date, date]:
    ref = reference or timezone.localdate()
    anchor = min(max(tenant.billing_anchor_day or 1, 1), 28)
    if tenant.billing_period == Tenant.BillingPeriod.YEARLY:
        start = date(ref.year, 1, 1)
        end = date(ref.year, 12, 31)
        return start, end
    # monthly: current month
    start = date(ref.year, ref.month, 1)
    if ref.month == 12:
        end = date(ref.year, 12, 31)
    else:
        end = date(ref.year, ref.month + 1, 1) - timedelta(days=1)
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

    user_count = tenant.active_user_count()
    if user_count == 0:
        raise ValueError("Tenant has no active users for billing.")

    active_modules = list(
        tenant.module_subscriptions.filter(is_active=True).values_list("module_slug", flat=True)
    )
    if not active_modules:
        raise ValueError("Tenant has no active module subscriptions.")

    prices = {
        p.module_slug: p.price_per_user_monthly
        for p in ModulePrice.objects.filter(is_active=True, module_slug__in=active_modules)
    }
    missing = [m for m in active_modules if m not in prices]
    if missing:
        raise ValueError(f"Missing module prices for: {', '.join(missing)}")

    months = 12 if tenant.billing_period == Tenant.BillingPeriod.YEARLY else 1
    subtotal_try = Decimal("0")
    line_data: list[dict] = []

    for slug in active_modules:
        monthly = prices[slug] * user_count
        line_try = monthly * months
        if tenant.billing_period == Tenant.BillingPeriod.YEARLY:
            discount = effective_yearly_discount(tenant)
            line_try = line_try * (Decimal("100") - discount) / Decimal("100")
        subtotal_try += line_try
        line_data.append(
            {
                "module_slug": slug,
                "description": f"{slug} ({user_count} users × {months} mo)",
                "user_count": user_count,
                "months": months,
                "line_try": line_try,
            }
        )

    subtotal_try = _quantize_money(subtotal_try)
    currency_code = tenant.payment_currency.code
    fx = get_latest_rate(currency_code)
    subtotal_currency = _quantize_money(convert_try_to_currency(subtotal_try, fx.rate_to_try))

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
        subtotal_excl_tax=subtotal_currency,
        tax_lines=tax_lines,
        total_incl_tax=total_incl,
        status=TenantSubscriptionInvoice.Status.DRAFT,
    )

    for item in line_data:
        unit_in_currency = _quantize_money(
            convert_try_to_currency(
                item["line_try"] / (item["user_count"] * item["months"]),
                fx.rate_to_try,
            )
        )
        TenantSubscriptionInvoiceLine.objects.create(
            invoice=invoice,
            module_slug=item["module_slug"],
            description=item["description"],
            user_count=item["user_count"],
            unit_price=unit_in_currency,
            months=item["months"],
            amount_excl_tax=_quantize_money(
                convert_try_to_currency(item["line_try"], fx.rate_to_try)
            ),
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
    invoice.save(update_fields=["status", "paid_at", "updated_at"])
    TenantSubscriptionPayment.objects.create(
        invoice=invoice,
        amount=invoice.total_incl_tax,
        paid_at=now,
        method=method,
        reference=reference,
    )
    return invoice
