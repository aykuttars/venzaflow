from __future__ import annotations

from apps.tenants.models import Tenant


def oral_tenant_ids() -> list[int]:
    ids: list[int] = []
    for tenant in Tenant.objects.filter(is_active=True).only("id", "enabled_modules"):
        if "oral" in (tenant.enabled_modules or []):
            ids.append(tenant.id)
    return ids
