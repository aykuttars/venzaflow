from __future__ import annotations

import base64

import requests

from .base import AuthorityAdapter, AuthorityError, SubmissionResult

BASE_URLS = {
    "test": "https://apitest.nilvera.com",
    "prod": "https://api.nilvera.com",
}


class NilveraAdapter(AuthorityAdapter):
    """Nilvera (özel entegratör) e-Fatura / e-Arşiv adapter.

    Credentials and environment come from the tenant's IntegrationConnection,
    not global settings. Endpoint paths / response schema must be confirmed
    against an active Nilvera sandbox before go-live.
    """

    provider_key = "nilvera"

    _PATHS = {
        "efatura": "/einvoice/Send/Xml",
        "earsiv": "/earchive/Send/Xml",
    }

    def __init__(self, credentials: dict, environment: str = "test",
                 signing_mode: str = "client_xades") -> None:
        self.api_key = (credentials or {}).get("api_key", "")
        self.environment = environment
        self.signing_mode = signing_mode
        self.base_url = BASE_URLS.get(environment, BASE_URLS["test"])
        self.timeout = 30

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def test_connection(self) -> tuple[bool, str]:
        if not self.api_key:
            return False, "API anahtarı girilmemiş."
        try:
            resp = requests.get(
                f"{self.base_url}/general/Company",
                headers=self._headers(),
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            return False, f"Bağlantı hatası: {exc}"
        if resp.status_code in (200, 204):
            return True, "Bağlantı başarılı."
        if resp.status_code in (401, 403):
            return False, "Kimlik doğrulama başarısız (API anahtarı geçersiz)."
        return False, f"Beklenmeyen yanıt: HTTP {resp.status_code}"

    def submit(self, task, *, signed_document: bytes | None = None) -> SubmissionResult:
        if not self.api_key:
            raise AuthorityError("Nilvera API anahtarı yapılandırılmamış.", retryable=False)
        if not signed_document:
            raise AuthorityError("İmzalı belge (UBL XML) bulunamadı.", retryable=False)

        path = self._PATHS.get(task.document_type, self._PATHS["efatura"])
        ettn = (task.metadata or {}).get("ettn") or ""
        body = {"UUID": ettn, "Content": base64.b64encode(signed_document).decode("ascii")}
        try:
            resp = requests.post(
                f"{self.base_url}{path}", json=body, headers=self._headers(), timeout=self.timeout
            )
        except requests.RequestException as exc:
            raise AuthorityError(f"Nilvera bağlantı hatası: {exc}", retryable=True) from exc

        if resp.status_code >= 500:
            raise AuthorityError(
                f"Nilvera sunucu hatası: HTTP {resp.status_code}", retryable=True, payload=_safe(resp)
            )
        if resp.status_code >= 400:
            raise AuthorityError(
                f"Nilvera reddetti: HTTP {resp.status_code}", retryable=False, payload=_safe(resp)
            )

        data = _safe(resp)
        external_ref = (
            (isinstance(data, dict) and (data.get("UUID") or data.get("InvoiceNumber")))
            or ettn
            or f"NILVERA-{task.id}"
        )
        return SubmissionResult(
            external_reference=str(external_ref),
            status="submitted",
            provider=self.provider_key,
            payload=data if isinstance(data, dict) else {"raw": str(data)[:2000]},
        )


def _safe(resp: requests.Response):
    try:
        return resp.json()
    except Exception:
        return {"status_code": resp.status_code, "text": resp.text[:2000]}
