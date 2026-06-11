from __future__ import annotations

from rest_framework import serializers

from apps.integrations.authority.providers import PROVIDER_BY_KEY
from apps.signing.models import (
    DocumentRouting,
    IntegrationConnection,
    TenantSigningProfile,
)
from apps.signing.services.integration_config import masked_credentials


class TenantSigningProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantSigningProfile
        fields = (
            "supplier_vkn",
            "supplier_title",
            "supplier_tax_office",
            "supplier_city",
            "supplier_district",
            "supplier_street",
            "supplier_country",
            "certificate_type",
        )


class IntegrationConnectionSerializer(serializers.ModelSerializer):
    provider_display = serializers.SerializerMethodField()
    credentials = serializers.SerializerMethodField()

    class Meta:
        model = IntegrationConnection
        fields = (
            "id",
            "display_name",
            "provider_key",
            "provider_display",
            "environment",
            "signing_mode",
            "is_active",
            "status",
            "status_message",
            "last_checked_at",
            "credentials",
        )
        read_only_fields = ("status", "status_message", "last_checked_at")

    def get_provider_display(self, obj: IntegrationConnection) -> str:
        meta = PROVIDER_BY_KEY.get(obj.provider_key)
        return meta["display_name"] if meta else obj.provider_key

    def get_credentials(self, obj: IntegrationConnection) -> dict:
        return masked_credentials(obj)


class IntegrationConnectionWriteSerializer(serializers.ModelSerializer):
    credentials = serializers.DictField(required=False, write_only=True)

    class Meta:
        model = IntegrationConnection
        fields = (
            "display_name",
            "provider_key",
            "environment",
            "signing_mode",
            "is_active",
            "credentials",
        )

    def validate_provider_key(self, value: str) -> str:
        if value not in PROVIDER_BY_KEY:
            raise serializers.ValidationError(f"Bilinmeyen sağlayıcı: {value}")
        return value


class DocumentRoutingSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentRouting
        fields = ("document_family", "connection")


class RoutingMapSerializer(serializers.Serializer):
    routings = DocumentRoutingSerializer(many=True)
