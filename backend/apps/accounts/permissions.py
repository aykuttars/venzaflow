from __future__ import annotations

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
    """Uses `required_module` slug on view; tenant must have enabled_modules containing it."""

    def has_permission(self, request, view):
        module = getattr(view, "required_module", None)
        if not module:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        tenant = getattr(user, "tenant", None)
        if not tenant:
            return False
        enabled = tenant.enabled_modules or []
        return module in enabled
