from __future__ import annotations

from decimal import Decimal

from apps.platform_billing.models import ModulePrice, PlatformBillingSettings
from apps.tenants.models import Tenant, TenantModuleSubscription


def resolve_module_prices(tenant: Tenant, module_slugs: list[str]) -> dict[str, Decimal]:
    """
    Resolve TRY/user/month per module: tenant subscription override, else global ModulePrice.
    """
    if not module_slugs:
        return {}

    global_prices = {
        p.module_slug: p.price_per_user_monthly
        for p in ModulePrice.objects.filter(is_active=True, module_slug__in=module_slugs)
    }
    overrides = {
        s.module_slug: s.price_per_user_monthly
        for s in TenantModuleSubscription.objects.filter(
            tenant=tenant,
            module_slug__in=module_slugs,
            is_active=True,
        ).exclude(price_per_user_monthly__isnull=True)
    }

    prices: dict[str, Decimal] = {}
    missing: list[str] = []
    for slug in module_slugs:
        if slug in overrides:
            prices[slug] = overrides[slug]
        elif slug in global_prices:
            prices[slug] = global_prices[slug]
        else:
            missing.append(slug)

    if missing:
        raise ValueError(f"Missing module prices for: {', '.join(missing)}")
    return prices


def effective_monthly_discount(tenant: Tenant) -> Decimal:
    if tenant.monthly_discount_percent is not None:
        return tenant.monthly_discount_percent
    return PlatformBillingSettings.get_solo().default_monthly_discount_percent


def effective_yearly_discount(tenant: Tenant) -> Decimal:
    if tenant.yearly_discount_percent is not None:
        return tenant.yearly_discount_percent
    return PlatformBillingSettings.get_solo().yearly_discount_percent


def effective_discount_for_period(tenant: Tenant) -> Decimal:
    if tenant.billing_period == Tenant.BillingPeriod.YEARLY:
        return effective_yearly_discount(tenant)
    return effective_monthly_discount(tenant)
