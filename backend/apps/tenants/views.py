from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantProfileSerializer


class TenantProfileView(APIView):
    """GET/PATCH current tenant profile (name only)."""

    permission_classes = [IsAuthenticated]

    def _can_manage(self, user) -> bool:
        if user.has_permission_codename("settings.write"):
            return True
        if user.department_id and user.department.key == "admin":
            return True
        return False

    def get(self, request):
        tenant = Tenant.objects.get(pk=request.user.tenant_id)
        return Response(TenantProfileSerializer(tenant).data)

    def patch(self, request):
        if not self._can_manage(request.user):
            return Response(
                {"detail": "You do not have permission to update tenant settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        tenant = Tenant.objects.get(pk=request.user.tenant_id)
        ser = TenantProfileSerializer(tenant, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)
