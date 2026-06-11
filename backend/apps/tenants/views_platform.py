from __future__ import annotations

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.generics import ListAPIView
from rest_framework.response import Response

from apps.accounts.permissions import IsPlatformAdmin
from apps.common.permission_codes import module_catalog
from apps.platform_billing.models import ModulePrice
from apps.tenants.models import Tenant
from apps.tenants.serializers_platform import (
    PlatformModuleCatalogSerializer,
    PlatformTenantSerializer,
)


class PlatformTenantViewSet(viewsets.ModelViewSet):
    """Platform admin CRUD for tenants and their module access."""

    permission_classes = [IsPlatformAdmin]
    queryset = Tenant.objects.all().order_by("customer_code")
    serializer_class = PlatformTenantSerializer
    search_fields = ("customer_code", "name")
    ordering_fields = ("customer_code", "name", "created_at")


@extend_schema(responses=PlatformModuleCatalogSerializer(many=True))
class PlatformModuleCatalogView(ListAPIView):
    """Single source of truth for the assignable module list.

    The platform admin UI consumes this instead of hardcoding module slugs, so
    adding a module to the backend automatically surfaces it in the panel.
    """

    permission_classes = [IsPlatformAdmin]
    serializer_class = PlatformModuleCatalogSerializer
    pagination_class = None

    def get_queryset(self):  # pragma: no cover - data assembled in list()
        return []

    def list(self, request, *args, **kwargs):
        prices = {
            mp.module_slug: mp.price_per_user_monthly
            for mp in ModulePrice.objects.filter(is_active=True)
        }
        catalog = []
        for entry in module_catalog():
            price = prices.get(entry["slug"])
            catalog.append(
                {
                    **entry,
                    "default_price_per_user_monthly": (
                        str(price) if price is not None else None
                    ),
                }
            )
        serializer = self.get_serializer(catalog, many=True)
        return Response(serializer.data)
