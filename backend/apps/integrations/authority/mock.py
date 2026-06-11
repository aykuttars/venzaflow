from __future__ import annotations

import uuid

from .base import AuthorityAdapter, SubmissionResult


class _MockAdapter(AuthorityAdapter):
    """Deterministic, credential-free adapter for local/dev/test.

    Mirrors the shape of a real integrator response (UUID echo, document
    number, accepted status) so the rest of the pipeline — web visibility,
    serializers, eimza polling — can be exercised end to end without a
    sandbox account.
    """

    prefix = "MOCK"

    def submit(self, task, *, signed_document: bytes | None = None) -> SubmissionResult:
        ettn = (task.metadata or {}).get("ettn") or str(uuid.uuid4())
        return SubmissionResult(
            external_reference=f"{self.prefix}-{ettn}",
            status="accepted",
            provider=self.provider_key,
            payload={
                "mock": True,
                "ettn": ettn,
                "document_type": task.document_type,
                "bytes_signed": len(signed_document or b""),
            },
        )

    def query_status(self, task) -> SubmissionResult:
        return SubmissionResult(
            external_reference=task.external_reference,
            status="accepted",
            provider=self.provider_key,
            payload={"mock": True},
        )


class MockEFaturaAdapter(_MockAdapter):
    provider_key = "mock"
    prefix = "GIB-EFATURA-MOCK"


class MockEArsivAdapter(_MockAdapter):
    provider_key = "mock"
    prefix = "GIB-EARSIV-MOCK"


class MockMedulaAdapter(_MockAdapter):
    provider_key = "mock"
    prefix = "MEDULA-MOCK"


def mock_adapter_for(document_type: str) -> AuthorityAdapter:
    from apps.signing.models import SignTask

    if document_type == SignTask.DocumentType.ERECETE:
        return MockMedulaAdapter()
    if document_type == SignTask.DocumentType.EARSIV:
        return MockEArsivAdapter()
    return MockEFaturaAdapter()
