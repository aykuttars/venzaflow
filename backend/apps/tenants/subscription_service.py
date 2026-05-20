from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.common.permission_codes import ALL_MODULES
from apps.tenants.models import Tenant, TenantModuleSubscription

User = get_user_model()


def validate_user_capacity(tenant: Tenant, *, excluding_user_id: int | None = None) -> None:
    """Raise ValidationError when tenant cannot add another active user."""
    qs = User.all_tenants.filter(tenant_id=tenant.pk, is_active=True)
    if excluding_user_id:
        qs = qs.exclude(pk=excluding_user_id)
    active = qs.count()
    if active >= tenant.max_users:
        raise serializers.ValidationError(
            {
                "detail": _(
                    "User limit reached (%(current)s/%(max)s). "
                    "Contact your provider for more seats."
                )
                % {"current": active, "max": tenant.max_users}
            }
        )


def set_module_subscriptions(
    tenant: Tenant,
    modules: list[str],
    *,
    extra_modules: set[str] | None = None,
    module_prices: dict[str, Decimal | None] | None = None,
) -> None:
    """Upsert module subscriptions and sync enabled_modules on tenant."""
    allowed = set(ALL_MODULES)
    extra = extra_modules or set()
    modules = list(dict.fromkeys(m for m in modules if m in allowed))
    extra = {m for m in extra if m in allowed and m in modules}
    price_map = module_prices or {}

    now = timezone.now()
    for slug in modules:
        sub, _ = TenantModuleSubscription.objects.get_or_create(
            tenant=tenant,
            module_slug=slug,
            defaults={"is_active": True, "is_extra": slug in extra},
        )
        sub.is_active = True
        sub.is_extra = slug in extra
        if sub.expires_at and sub.expires_at < now:
            sub.expires_at = None
        if slug in price_map:
            sub.price_per_user_monthly = price_map[slug]
        sub.save()

    TenantModuleSubscription.objects.filter(tenant=tenant).exclude(
        module_slug__in=modules
    ).update(is_active=False)

    tenant.sync_enabled_modules_from_subscriptions()


def apply_module_prices(
    tenant: Tenant,
    module_prices: dict[str, Decimal | None],
) -> None:
    """Update price overrides on existing subscription rows."""
    for slug, price in module_prices.items():
        if slug not in ALL_MODULES:
            continue
        TenantModuleSubscription.objects.filter(
            tenant=tenant,
            module_slug=slug,
            is_active=True,
        ).update(price_per_user_monthly=price)


def bootstrap_subscriptions_from_enabled_modules(tenant: Tenant) -> None:
    """Create subscription rows from legacy enabled_modules JSON."""
    modules = list(tenant.enabled_modules or [])
    if modules:
        set_module_subscriptions(tenant, modules, extra_modules=set())
