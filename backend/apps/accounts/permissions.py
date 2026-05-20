from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from rest_framework import permissions


class HasViewPermission(permissions.BasePermission):
    """Uses `required_permission` codename on view / viewset."""

    def has_permission(self, request, view):
        codename = getattr(view, "required_permission", None)
        if not codename:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.has_permission_codename(codename)


class HasModule(permissions.BasePermission):
    """Tenant must be active and have an active module subscription for required_module."""

    def has_permission(self, request, view):
        module = getattr(view, "required_module", None)
        if not module:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, "is_platform_admin", False):
            return False
        tenant = getattr(user, "tenant", None)
        if not tenant or not tenant.is_active:
            return False
        now = timezone.now()
        if tenant.module_subscriptions.filter(
            module_slug=module,
            is_active=True,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now)).exists():
            return True
        return module in (tenant.enabled_modules or [])


class IsPlatformAdmin(permissions.BasePermission):
    """Platform super admin: is_superuser with no tenant."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and getattr(user, "is_platform_admin", False)
        )
