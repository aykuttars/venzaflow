from __future__ import annotations

from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.accounts.models import Department
from apps.accounts.rbac import assert_department_manageable, filter_assignable_departments
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

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related("permissions")
        if self.request.query_params.get("assignable") == "1":
            qs = filter_assignable_departments(self.request.user, qs)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.key == "admin":
            return Response(
                {"detail": _("The admin department cannot be deleted.")},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            assert_department_manageable(request.user, instance)
        except PermissionDenied as exc:
            return Response({"detail": exc.detail}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)
