"""Per-tenant signing/integration configuration helpers.

Bridges the connection + routing models with the authority adapters and the
UBL builder. Credentials are encrypted at rest via apps.common.secretbox and
never leave the server in plaintext.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings

from apps.common.secretbox import decrypt_json, encrypt_json, mask_secret
from apps.integrations.authority.providers import provider_meta, secret_field_names
from apps.signing.models import (
    DocumentRouting,
    IntegrationConnection,
    TenantSigningProfile,
)


def get_profile(tenant) -> TenantSigningProfile:
    defaults = settings.AUTHORITY_SUPPLIER_DEFAULTS
    profile, _ = TenantSigningProfile.objects.get_or_create(
        tenant=tenant,
        defaults={
            "supplier_vkn": defaults.get("vkn", ""),
            "supplier_title": defaults.get("title", "") or tenant.name,
            "supplier_tax_office": defaults.get("tax_office", ""),
            "supplier_city": defaults.get("city", ""),
            "supplier_district": defaults.get("district", ""),
            "supplier_street": defaults.get("street", ""),
            "supplier_country": defaults.get("country", "Türkiye"),
        },
    )
    return profile


def supplier_dict(tenant) -> dict[str, str]:
    p = get_profile(tenant)
    return {
        "vkn": p.supplier_vkn,
        "title": p.supplier_title or tenant.name,
        "tax_office": p.supplier_tax_office,
        "city": p.supplier_city,
        "district": p.supplier_district,
        "street": p.supplier_street,
        "country": p.supplier_country or "Türkiye",
    }


def resolve_connection(tenant, document_type: str) -> IntegrationConnection | None:
    routing = (
        DocumentRouting.objects.filter(tenant=tenant, document_family=document_type)
        .select_related("connection")
        .first()
    )
    if routing and routing.connection and routing.connection.is_active:
        return routing.connection
    return None


def connection_credentials(connection: IntegrationConnection) -> dict[str, Any]:
    return decrypt_json(connection.credentials_encrypted)


def update_connection_credentials(
    connection: IntegrationConnection, incoming: dict[str, Any]
) -> None:
    """Merge incoming credential fields over the stored ones, then encrypt.

    Empty/omitted secret fields keep their previous value so the client can
    save other settings without re-entering secrets.
    """
    current = connection_credentials(connection)
    secrets = secret_field_names(connection.provider_key)
    merged = dict(current)
    for key, value in (incoming or {}).items():
        if key in secrets and (value is None or value == ""):
            continue  # keep existing secret
        merged[key] = value
    connection.credentials_encrypted = encrypt_json(merged)


def masked_credentials(connection: IntegrationConnection) -> dict[str, Any]:
    """Non-sensitive view of stored credentials for the panel."""
    meta = provider_meta(connection.provider_key)
    stored = connection_credentials(connection)
    out: dict[str, Any] = {}
    if not meta:
        return out
    for field in meta["auth_fields"]:
        name = field["name"]
        value = stored.get(name, "")
        if field.get("secret"):
            out[name] = {"set": bool(value), "hint": mask_secret(value) if value else ""}
        else:
            out[name] = value
    return out
