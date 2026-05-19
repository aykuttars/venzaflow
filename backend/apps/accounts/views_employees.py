from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.response import Response

from apps.accounts.serializers_employees import EmployeeUserSerializer
from apps.common.viewsets import TenantScopedViewSet

User = get_user_model()


class EmployeeViewSet(TenantScopedViewSet):
    """
    Tenant staff users (every user is an employee).
    URL kept as /employees/ for the admin panel.
    """

    serializer_class = EmployeeUserSerializer
    required_module = "employees"
    action_permission_map = {
        "list": "employees.read",
        "retrieve": "employees.read",
        "create": "employees.write",
        "update": "employees.write",
        "partial_update": "employees.write",
        "destroy": "employees.write",
    }
    search_fields = ("email", "first_name", "last_name")
    ordering_fields = ("email", "first_name", "last_name", "is_active")

    def get_queryset(self):
        tenant_id = getattr(self.request.user, "tenant_id", None)
        if tenant_id is None:
            return User.all_tenants.none()
        return (
            User.all_tenants.filter(tenant_id=tenant_id)
            .select_related("department", "tenant")
            .prefetch_related("extra_permissions")
            .order_by("email")
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def perform_create(self, serializer):
        serializer.save(tenant_id=self.request.user.tenant_id)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.pk == request.user.pk:
            return Response(
                {"detail": _("You cannot delete your own account.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            instance.department_id
            and instance.department.key == "admin"
            and instance.is_active
        ):
            others = User.all_tenants.filter(
                tenant_id=instance.tenant_id,
                is_active=True,
                department__key="admin",
            ).exclude(pk=instance.pk)
            if not others.exists():
                return Response(
                    {"detail": _("Cannot delete the last admin for this tenant.")},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return super().destroy(request, *args, **kwargs)
