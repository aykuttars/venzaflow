from __future__ import annotations

from django.db import models

from apps.tenants.context import get_current_tenant_id


class Tenant(models.Model):
    """Company / tenant root. Lives in shared schema (not TenantOwnedModel)."""

    customer_code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    enabled_modules = models.JSONField(
        default=list,
        help_text="Module slugs this tenant can use, e.g. ['products', 'billing'].",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["customer_code"]

    def __str__(self) -> str:
        return f"{self.customer_code} — {self.name}"


class TenantScopedManager(models.Manager):
    """Default manager: filters to current tenant when set."""

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = get_current_tenant_id()
        if tenant_id is not None:
            return qs.filter(tenant_id=tenant_id)
        return qs


class AllTenantsManager(models.Manager):
    """Bypass tenant filter (admin, seeds, migrations)."""

    def get_queryset(self):
        return super().get_queryset()


class TenantOwnedModel(models.Model):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="%(class)s_set",
        db_index=True,
    )

    objects = TenantScopedManager()
    all_tenants = AllTenantsManager()

    class Meta:
        abstract = True
