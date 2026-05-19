"""Thread-local current tenant for request lifecycle."""

from __future__ import annotations

_thread_tenant_id: int | None = None


def get_current_tenant_id() -> int | None:
    return _thread_tenant_id


def set_current_tenant_id(tenant_id: int | None) -> None:
    global _thread_tenant_id
    _thread_tenant_id = tenant_id


def clear_current_tenant() -> None:
    set_current_tenant_id(None)


def set_tenant_context(tenant_id: int) -> None:
    """Alias used by middleware after JWT validation."""
    set_current_tenant_id(tenant_id)
