from __future__ import annotations

from rest_framework import viewsets

from apps.accounts.permissions import IsPlatformAdmin
from apps.tenants.models import Tenant
from apps.tenants.serializers_platform import PlatformTenantSerializer


class PlatformTenantViewSet(viewsets.ModelViewSet):
    """Platform admin CRUD for tenants and their module access."""

    permission_classes = [IsPlatformAdmin]
    queryset = Tenant.objects.all().order_by("customer_code")
    serializer_class = PlatformTenantSerializer
    search_fields = ("customer_code", "name")
    ordering_fields = ("customer_code", "name", "created_at")
