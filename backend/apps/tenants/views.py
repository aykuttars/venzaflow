from __future__ import annotations

from django.utils.translation import gettext as _
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.rbac import is_tenant_manager
from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantProfileSerializer


class TenantProfileView(APIView):
    """GET/PATCH current tenant profile (name, default_language). Admin only for PATCH."""

    permission_classes = [IsAuthenticated]

    def _can_manage(self, user) -> bool:
        return is_tenant_manager(user)

    def get(self, request):
        tenant = Tenant.objects.get(pk=request.user.tenant_id)
        return Response(TenantProfileSerializer(tenant).data)

    def patch(self, request):
        if not self._can_manage(request.user):
            return Response(
                {"detail": _("You do not have permission to update tenant settings.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        tenant = Tenant.objects.get(pk=request.user.tenant_id)
        ser = TenantProfileSerializer(tenant, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
