from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from rest_framework import serializers

from apps.common.permission_codes import ALL_MODULES, NON_BILLABLE_MODULES, merge_tenant_modules
from apps.tenants.models import Tenant, TenantModuleSubscription

User = get_user_model()


def tenant_has_module(tenant: Tenant, module_slug: str) -> bool:
    """True when tenant has an active subscription or legacy enabled_modules entry."""
    if module_slug in NON_BILLABLE_MODULES:
        return True
    now = timezone.now()
    if tenant.module_subscriptions.filter(
        module_slug=module_slug,
        is_active=True,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).exists():
        return True
    return module_slug in (tenant.enabled_modules or [])


def validate_module_parents(
    modules: list[str],
    module_parents: dict[str, str] | None,
) -> dict[str, str]:
    """Validate and normalize child -> parent module map."""
    if not module_parents:
        return {}
    allowed = set(ALL_MODULES)
    module_set = set(modules)
    parents: dict[str, str] = {}
    for child, parent in module_parents.items():
        if child not in allowed:
            raise serializers.ValidationError(
                {"module_parents": f"Unknown child module: {child}"}
            )
        if parent not in allowed:
            raise serializers.ValidationError(
                {"module_parents": f"Unknown parent module: {parent}"}
            )
        if child == parent:
            raise serializers.ValidationError(
                {"module_parents": f"Module cannot be its own parent: {child}"}
            )
        if child in NON_BILLABLE_MODULES:
            raise serializers.ValidationError(
                {"module_parents": f"Non-billable module cannot have a parent: {child}"}
            )
        if parent in NON_BILLABLE_MODULES:
            raise serializers.ValidationError(
                {"module_parents": f"Non-billable module cannot be a parent: {parent}"}
            )
        if child not in module_set:
            raise serializers.ValidationError(
                {"module_parents": f"Child module must be subscribed: {child}"}
            )
        if parent not in module_set:
            raise serializers.ValidationError(
                {"module_parents": f"Parent module must be subscribed: {parent}"}
            )
        parents[child] = parent

    # Cycle detection
    for start in parents:
        seen: set[str] = set()
        current: str | None = start
        while current:
            if current in seen:
                raise serializers.ValidationError(
                    {"module_parents": "Module parent chain contains a cycle."}
                )
            seen.add(current)
            current = parents.get(current)
    return parents


def tenant_module_parents(tenant: Tenant) -> dict[str, str]:
    """Active child -> parent map from subscription rows."""
    return {
        s.module_slug: s.parent_module_slug
        for s in tenant.module_subscriptions.filter(is_active=True)
        if s.parent_module_slug
    }


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
    non_billable_modules: set[str] | None = None,
    module_prices: dict[str, Decimal | None] | None = None,
    module_parents: dict[str, str] | None = None,
) -> None:
    """Upsert module subscriptions and sync enabled_modules on tenant."""
    allowed = set(ALL_MODULES)
    extra = extra_modules or set()
    modules = list(dict.fromkeys(m for m in modules if m in allowed))
    modules = merge_tenant_modules(modules)
    extra = {m for m in extra if m in allowed and m in modules and m not in NON_BILLABLE_MODULES}

    not_billed = set(non_billable_modules or set())
    not_billed.update(NON_BILLABLE_MODULES)
    not_billed = {m for m in not_billed if m in modules}

    parent_map = validate_module_parents(modules, module_parents)

    price_map = module_prices or {}

    now = timezone.now()
    for slug in modules:
        is_billable = slug not in not_billed
        parent_slug = parent_map.get(slug)
        sub, _ = TenantModuleSubscription.objects.get_or_create(
            tenant=tenant,
            module_slug=slug,
            defaults={
                "is_active": True,
                "is_extra": slug in extra and slug not in NON_BILLABLE_MODULES,
                "is_billable": is_billable,
                "parent_module_slug": parent_slug,
            },
        )
        sub.is_active = True
        sub.is_extra = slug in extra and slug not in NON_BILLABLE_MODULES
        sub.is_billable = is_billable
        sub.parent_module_slug = parent_slug
        if sub.expires_at and sub.expires_at < now:
            sub.expires_at = None
        if slug in price_map:
            sub.price_per_user_monthly = price_map[slug]
        sub.save()

    TenantModuleSubscription.objects.filter(tenant=tenant).exclude(
        module_slug__in=modules
    ).update(is_active=False, parent_module_slug=None)

    TenantModuleSubscription.objects.filter(
        tenant=tenant, module_slug__in=NON_BILLABLE_MODULES
    ).update(is_active=True, is_extra=False, is_billable=False, parent_module_slug=None)

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
