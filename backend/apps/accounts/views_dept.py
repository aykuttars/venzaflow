from __future__ import annotations

from apps.accounts.models import Department
from apps.accounts.serializers import DepartmentSerializer
from apps.common.viewsets import TenantScopedViewSet


class DepartmentViewSet(TenantScopedViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    required_module = "settings"
    action_permission_map = {
        "list": "settings.read",
        "retrieve": "settings.read",
        "create": "settings.write",
        "update": "settings.write",
        "partial_update": "settings.write",
        "destroy": "settings.write",
    }
    search_fields = ("name", "key")
    ordering_fields = ("name", "key")
