from __future__ import annotations

from abc import ABC, abstractmethod

from apps.signing.models import SignTask


class AuthorityAdapter(ABC):
    @abstractmethod
    def submit(self, task: SignTask) -> str:
        """Submit signed document to external authority. Returns external reference."""


class MedulaAdapter(AuthorityAdapter):
    """Stub adapter for Medula e-Reçete submission."""

    def submit(self, task: SignTask) -> str:
        return f"MEDULA-STUB-{task.id}"


class GibEArsivAdapter(AuthorityAdapter):
    """Stub adapter for GİB e-Arşiv submission."""

    def submit(self, task: SignTask) -> str:
        return f"GIB-EARSIV-STUB-{task.id}"


class GibEFaturaAdapter(AuthorityAdapter):
    """Stub adapter for GİB e-Fatura submission."""

    def submit(self, task: SignTask) -> str:
        return f"GIB-EFATURA-STUB-{task.id}"


def get_authority_adapter(document_type: str) -> AuthorityAdapter:
    if document_type == SignTask.DocumentType.ERECETE:
        return MedulaAdapter()
    if document_type == SignTask.DocumentType.EARSIV:
        return GibEArsivAdapter()
    if document_type == SignTask.DocumentType.EFATURA:
        return GibEFaturaAdapter()
    raise ValueError(f"Unsupported document type: {document_type}")


def submit_to_authority(task: SignTask) -> str:
    adapter = get_authority_adapter(task.document_type)
    return adapter.submit(task)
