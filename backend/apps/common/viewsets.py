from __future__ import annotations

from rest_framework import viewsets

from apps.accounts.permissions import HasModule, HasViewPermission


class TenantScopedViewSet(viewsets.ModelViewSet):
    """
    Enforces tenant on queryset and create(). Combine with TenantScopedManager on models.
    Set `required_module`, `action_permission_map` (action -> codename), or `required_permission` fallback.
    """

    permission_classes = [HasModule, HasViewPermission]
    required_module: str | None = None
    required_permission: str | None = None
    action_permission_map: dict[str, str] | None = None

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        act = getattr(self, "action", None)
        if act and self.action_permission_map:
            self.required_permission = self.action_permission_map.get(act)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        tenant_id = getattr(user, "tenant_id", None)
        if tenant_id is None:
            return qs.none()
        return qs.filter(tenant_id=tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.user.tenant_id)
