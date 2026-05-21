from __future__ import annotations

from django.db.models import Q
from django.utils.translation import gettext as _
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import Permission
from apps.accounts.rbac import filter_grantable_codenames, is_tenant_manager
from apps.accounts.serializers import PermissionSerializer
from apps.common.permission_codes import tenant_allowed_permission_modules


class PermissionListView(ListAPIView):
    """Permission catalog for department/user assignment — scoped to tenant modules."""

    queryset = Permission.objects.all()
    serializer_class = PermissionSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def check_permissions(self, request):
        super().check_permissions(request)
        user = request.user
        if not (
            user.has_permission_codename("settings.read")
            or user.has_permission_codename("employees.write")
        ):
            raise PermissionDenied(_("You do not have permission to list permissions."))

    def get_queryset(self):
        qs = super().get_queryset()
        tenant = getattr(self.request.user, "tenant", None)
        if not tenant:
            return qs
        allowed = tenant_allowed_permission_modules(tenant.enabled_modules)
        q = Q()
        for mod in allowed:
            q |= Q(codename__startswith=f"{mod}.")
        qs = qs.filter(q).order_by("codename")
        if not is_tenant_manager(self.request.user):
            grantable = set(
                filter_grantable_codenames(
                    self.request.user,
                    list(qs.values_list("codename", flat=True)),
                )
            )
            qs = qs.filter(codename__in=grantable)
        return qs
