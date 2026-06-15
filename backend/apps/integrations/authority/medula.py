from __future__ import annotations

from .base import AuthorityAdapter, AuthorityError, SubmissionResult
from .medula_constants import MEDULA_TEST_TESIS_KODU
from .medula_soap import MedulaSoapClient, MedulaSoapError
from .medula_xml import medula_context_from_task


class MedulaAdapter(AuthorityAdapter):
    """Medula (SGK) e-Reçete adapter.

    Submits XAdES-BES enveloping signed erecete XML via ``imzaliEreceteGiris``.
    Test credentials are published in the SGK web service guide (sgkt.sgk.gov.tr).
    """

    provider_key = "medula"

    def __init__(
        self,
        credentials: dict,
        environment: str = "test",
        signing_mode: str = "client_xades",
    ) -> None:
        creds = credentials or {}
        self.username = creds.get("username", "")
        self.password = creds.get("password", "")
        self.tesis_kodu = str(creds.get("tesis_kodu", "")).strip()
        self.environment = environment
        self.signing_mode = signing_mode

    def _client(self) -> MedulaSoapClient:
        return MedulaSoapClient(
            username=self.username,
            password=self.password,
            environment=self.environment,
        )

    def test_connection(self) -> tuple[bool, str]:
        if not (self.username and self.password and self.tesis_kodu):
            return False, "Medula kullanıcı/parola/tesis kodu eksik."
        try:
            return self._client().test_connection(
                tesis_kodu=int(self.tesis_kodu),
                doktor_tc=self.username,
                hasta_tc="22222222220",
            )
        except MedulaSoapError as exc:
            return False, str(exc)

    def submit(self, task, *, signed_document: bytes | None = None) -> SubmissionResult:
        if not (self.username and self.password and self.tesis_kodu):
            raise AuthorityError("Medula kimlik bilgileri eksik.", retryable=False)
        if not signed_document:
            raise AuthorityError(
                "İmzalı e-Reçete XML bulunamadı. Önce prepare/complete akışını tamamlayın.",
                retryable=False,
            )

        ctx = medula_context_from_task(task)
        tesis_kodu = int(self.tesis_kodu or ctx["tesis_kodu"] or MEDULA_TEST_TESIS_KODU)
        doktor_tc = str(ctx["doktor_tc"])

        try:
            payload = self._client().imzali_erecete_giris(
                signed_xml=signed_document,
                tesis_kodu=tesis_kodu,
                doktor_tc=doktor_tc,
            )
        except MedulaSoapError as exc:
            retryable = bool((exc.payload or {}).get("retryable"))
            raise AuthorityError(str(exc), retryable=retryable, payload=exc.payload) from exc

        external_ref = payload.get("ereceteNo") or f"MEDULA-{task.id}"
        return SubmissionResult(
            external_reference=str(external_ref),
            status="submitted",
            provider=self.provider_key,
            payload=payload,
        )
