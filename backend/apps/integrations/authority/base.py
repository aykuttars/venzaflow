from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class AuthorityError(Exception):
    """Raised when an authority/integrator submission fails.

    ``retryable`` lets the caller decide whether re-submitting the same task
    (idempotency key = external UUID) is safe.
    """

    def __init__(self, message: str, *, retryable: bool = False, payload: Any = None) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.payload = payload


@dataclass
class SubmissionResult:
    """Normalized result returned by every authority adapter."""

    external_reference: str
    status: str = "submitted"
    provider: str = ""
    # Raw provider response kept for audit / troubleshooting (no secrets).
    payload: dict[str, Any] = field(default_factory=dict)


class AuthorityAdapter(ABC):
    """Contract every e-document authority/integrator adapter implements.

    Adapters must be idempotent with respect to the task's stable UUID so a
    retry after a network blip does not create a duplicate document.
    """

    #: Stable key used in settings.AUTHORITY_PROVIDERS and the registry.
    provider_key: str = ""

    @abstractmethod
    def submit(self, task, *, signed_document: bytes | None = None) -> SubmissionResult:
        """Submit a signed document to the authority and return a reference."""

    def query_status(self, task) -> SubmissionResult:  # pragma: no cover - optional
        """Poll the authority for the current document status."""
        raise NotImplementedError(
            f"{self.__class__.__name__} does not support status queries yet."
        )
