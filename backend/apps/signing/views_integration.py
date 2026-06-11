from __future__ import annotations

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission, IsPlatformAdmin
from apps.common.viewsets import TenantScopedViewSet
from apps.integrations.authority.providers import PROVIDER_CATALOG
from apps.integrations.authority.registry import build_adapter
from apps.signing.models import (
    DocumentRouting,
    IntegrationConnection,
    TenantSigningProfile,
)
from apps.signing.serializers_integration import (
    DocumentRoutingSerializer,
    IntegrationConnectionSerializer,
    IntegrationConnectionWriteSerializer,
    TenantSigningProfileSerializer,
)
from apps.signing.services.integration_config import (
    get_profile,
    update_connection_credentials,
)
from apps.tenants.models import Tenant


# ---------------------------------------------------------------------------
# Shared logic (used by both tenant-admin and platform-admin endpoints)
# ---------------------------------------------------------------------------

def _save_connection(connection: IntegrationConnection, write_serializer) -> IntegrationConnection:
    data = write_serializer.validated_data
    credentials = data.pop("credentials", None)
    for field, value in data.items():
        setattr(connection, field, value)
    if credentials is not None:
        update_connection_credentials(connection, credentials)
    connection.save()
    return connection


def _test_connection(connection: IntegrationConnection) -> dict:
    adapter = build_adapter(connection)
    if adapter is None or not hasattr(adapter, "test_connection"):
        ok, message = False, "Bu sağlayıcı için bağlantı testi desteklenmiyor."
    else:
        ok, message = adapter.test_connection()
    connection.status = (
        IntegrationConnection.Status.OK if ok else IntegrationConnection.Status.ERROR
    )
    connection.status_message = message[:255]
    connection.last_checked_at = timezone.now()
    connection.save(update_fields=["status", "status_message", "last_checked_at", "updated_at"])
    return {"ok": ok, "message": message}


def _set_routing(tenant, routings: list[dict]) -> None:
    valid_conn_ids = set(
        IntegrationConnection.objects.filter(tenant=tenant).values_list("id", flat=True)
    )
    for row in routings:
        family = row["document_family"]
        connection = row["connection"]
        if connection.id not in valid_conn_ids:
            continue  # ignore connections that are not this tenant's
        DocumentRouting.objects.update_or_create(
            tenant=tenant,
            document_family=family,
            defaults={"connection": connection},
        )


def _integration_payload(tenant) -> dict:
    profile = get_profile(tenant)
    connections = IntegrationConnection.objects.filter(tenant=tenant)
    routings = DocumentRouting.objects.filter(tenant=tenant)
    return {
        "providers": PROVIDER_CATALOG,
        "profile": TenantSigningProfileSerializer(profile).data,
        "connections": IntegrationConnectionSerializer(connections, many=True).data,
        "routing": DocumentRoutingSerializer(routings, many=True).data,
    }


# ---------------------------------------------------------------------------
# Tenant-admin endpoints (web panel) — gated by the signing module + perms
# ---------------------------------------------------------------------------

class IntegrationConnectionViewSet(TenantScopedViewSet):
    queryset = IntegrationConnection.objects.all()
    serializer_class = IntegrationConnectionSerializer
    required_module = "signing"
    action_permission_map = {
        "list": "signing.read",
        "retrieve": "signing.read",
        "create": "signing.write",
        "update": "signing.write",
        "partial_update": "signing.write",
        "destroy": "signing.write",
        "test": "signing.write",
    }

    def create(self, request, *args, **kwargs):
        write = IntegrationConnectionWriteSerializer(data=request.data)
        write.is_valid(raise_exception=True)
        connection = IntegrationConnection(tenant_id=request.user.tenant_id)
        _save_connection(connection, write)
        return Response(
            IntegrationConnectionSerializer(connection).data, status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        connection = self.get_object()
        write = IntegrationConnectionWriteSerializer(
            data=request.data, partial=partial
        )
        write.is_valid(raise_exception=True)
        _save_connection(connection, write)
        return Response(IntegrationConnectionSerializer(connection).data)

    @action(detail=True, methods=["post"], url_path="test")
    def test(self, request, pk=None):
        connection = self.get_object()
        return Response(_test_connection(connection))


class SigningProfileView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "signing"

    def get(self, request):
        self.required_permission = "signing.read"
        return Response(_integration_payload(request.user.tenant))

    def put(self, request):
        self.required_permission = "signing.write"
        profile = get_profile(request.user.tenant)
        ser = TenantSigningProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class SigningRoutingView(APIView):
    permission_classes = [HasModule, HasViewPermission]
    required_module = "signing"

    def put(self, request):
        self.required_permission = "signing.write"
        ser = DocumentRoutingSerializer(
            data=request.data.get("routings", []), many=True
        )
        ser.is_valid(raise_exception=True)
        _set_routing(request.user.tenant, ser.validated_data)
        routings = DocumentRouting.objects.filter(tenant=request.user.tenant)
        return Response(DocumentRoutingSerializer(routings, many=True).data)


# ---------------------------------------------------------------------------
# Platform-admin override endpoints — manage any tenant's integration config
# ---------------------------------------------------------------------------

class PlatformTenantIntegrationView(APIView):
    permission_classes = [IsPlatformAdmin]

    def _tenant(self, tenant_pk) -> Tenant:
        return get_object_or_404(Tenant, pk=tenant_pk)

    def get(self, request, tenant_pk):
        return Response(_integration_payload(self._tenant(tenant_pk)))

    def put(self, request, tenant_pk):
        tenant = self._tenant(tenant_pk)
        profile = get_profile(tenant)
        ser = TenantSigningProfileSerializer(profile, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(_integration_payload(tenant))


class PlatformTenantConnectionView(APIView):
    permission_classes = [IsPlatformAdmin]

    def _tenant(self, tenant_pk) -> Tenant:
        return get_object_or_404(Tenant, pk=tenant_pk)

    def post(self, request, tenant_pk):
        tenant = self._tenant(tenant_pk)
        write = IntegrationConnectionWriteSerializer(data=request.data)
        write.is_valid(raise_exception=True)
        connection = IntegrationConnection(tenant=tenant)
        _save_connection(connection, write)
        return Response(
            IntegrationConnectionSerializer(connection).data, status=status.HTTP_201_CREATED
        )

    def put(self, request, tenant_pk, pk):
        tenant = self._tenant(tenant_pk)
        connection = get_object_or_404(IntegrationConnection, pk=pk, tenant=tenant)
        write = IntegrationConnectionWriteSerializer(data=request.data, partial=True)
        write.is_valid(raise_exception=True)
        _save_connection(connection, write)
        return Response(IntegrationConnectionSerializer(connection).data)

    def delete(self, request, tenant_pk, pk):
        tenant = self._tenant(tenant_pk)
        connection = get_object_or_404(IntegrationConnection, pk=pk, tenant=tenant)
        connection.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlatformTenantConnectionTestView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request, tenant_pk, pk):
        tenant = get_object_or_404(Tenant, pk=tenant_pk)
        connection = get_object_or_404(IntegrationConnection, pk=pk, tenant=tenant)
        return Response(_test_connection(connection))


class PlatformTenantRoutingView(APIView):
    permission_classes = [IsPlatformAdmin]

    def put(self, request, tenant_pk):
        tenant = get_object_or_404(Tenant, pk=tenant_pk)
        ser = DocumentRoutingSerializer(data=request.data.get("routings", []), many=True)
        ser.is_valid(raise_exception=True)
        _set_routing(tenant, ser.validated_data)
        routings = DocumentRouting.objects.filter(tenant=tenant)
        return Response(DocumentRoutingSerializer(routings, many=True).data)
