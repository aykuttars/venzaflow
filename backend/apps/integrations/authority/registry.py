from __future__ import annotations

from django.conf import settings

from .base import AuthorityAdapter, SubmissionResult
from .medula import MedulaAdapter
from .mock import mock_adapter_for
from .nilvera import NilveraAdapter

#: provider_key -> adapter class (constructed with credentials/env/signing_mode)
PROVIDERS = {
    "nilvera": NilveraAdapter,
    "medula": MedulaAdapter,
}


def build_adapter(connection) -> AuthorityAdapter | None:
    """Instantiate the adapter for a tenant's IntegrationConnection."""
    factory = PROVIDERS.get(connection.provider_key)
    if factory is None:
        return None
    # Imported lazily to avoid a model<->integrations import cycle at load.
    from apps.signing.services.integration_config import connection_credentials

    return factory(
        connection_credentials(connection),
        environment=connection.environment,
        signing_mode=connection.signing_mode,
    )


def get_authority_adapter(task) -> AuthorityAdapter:
    """Resolve the adapter for a task from the tenant's routing/connection.

    Falls back to the mock adapter when AUTHORITY_MOCK is on, when the tenant
    has no active routing for the family, or when the provider is unknown — so
    the pipeline never hard-fails on a missing configuration.
    """
    if getattr(settings, "AUTHORITY_MOCK", True):
        return mock_adapter_for(task.document_type)

    from apps.signing.services.integration_config import resolve_connection

    connection = resolve_connection(task.tenant, task.document_type)
    if connection is None:
        return mock_adapter_for(task.document_type)

    adapter = build_adapter(connection)
    if adapter is None:
        return mock_adapter_for(task.document_type)
    return adapter


def submit_to_authority(task, *, signed_document: bytes | None = None) -> SubmissionResult:
    adapter = get_authority_adapter(task)
    return adapter.submit(task, signed_document=signed_document)
