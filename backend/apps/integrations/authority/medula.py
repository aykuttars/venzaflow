from __future__ import annotations

from .base import AuthorityAdapter, AuthorityError, SubmissionResult


class MedulaAdapter(AuthorityAdapter):
    """Medula (SGK) e-Reçete adapter.

    Credentials come from the tenant's IntegrationConnection. Medula exposes
    SOAP services requiring an SGK agreement + facility credentials; the
    e-prescription number is issued by Medula and the physician signs with a
    qualified personal e-signature. Live SOAP wiring is gated until sandbox
    access exists; AUTHORITY_MOCK keeps the mock adapter in front meanwhile.
    """

    provider_key = "medula"

    def __init__(self, credentials: dict, environment: str = "test",
                 signing_mode: str = "client_xades") -> None:
        creds = credentials or {}
        self.username = creds.get("username", "")
        self.password = creds.get("password", "")
        self.tesis_kodu = creds.get("tesis_kodu", "")
        self.environment = environment
        self.signing_mode = signing_mode

    def test_connection(self) -> tuple[bool, str]:
        if not (self.username and self.password and self.tesis_kodu):
            return False, "Medula kullanıcı/parola/tesis kodu eksik."
        return False, "Medula canlı doğrulama henüz etkin değil (sandbox bekleniyor)."

    def submit(self, task, *, signed_document: bytes | None = None) -> SubmissionResult:
        if not (self.username and self.password and self.tesis_kodu):
            raise AuthorityError("Medula kimlik bilgileri eksik.", retryable=False)
        raise AuthorityError(
            "Medula canlı entegrasyonu henüz etkin değil; sandbox erişimi bekleniyor.",
            retryable=False,
        )
