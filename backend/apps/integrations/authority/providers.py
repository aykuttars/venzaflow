"""Provider capability catalog — the single source of truth for the UI.

Adding a new integrator = add an entry here + an adapter class registered in
registry.PROVIDERS. The panel renders the credential form dynamically from
``auth_fields`` so no frontend change is required for a new provider.
"""

from __future__ import annotations

EFATURA = "efatura"
EARSIV = "earsiv"
ERECETE = "erecete"

CLIENT_XADES = "client_xades"
PROVIDER_SEAL = "provider_seal"


def _field(name: str, label: str, *, type_: str = "text", required: bool = True,
           secret: bool = False) -> dict:
    return {"name": name, "label": label, "type": type_, "required": required, "secret": secret}


PROVIDER_CATALOG: list[dict] = [
    {
        "key": "nilvera",
        "display_name": "Nilvera",
        "kind": "rest",
        "supported_families": [EFATURA, EARSIV],
        "environments": ["test", "prod"],
        "signing_modes": [CLIENT_XADES, PROVIDER_SEAL],
        "auth_fields": [
            _field("api_key", "API Anahtarı", type_="password", secret=True),
        ],
    },
    {
        "key": "uyumsoft",
        "display_name": "Uyumsoft",
        "kind": "soap",
        "supported_families": [EFATURA, EARSIV],
        "environments": ["test", "prod"],
        "signing_modes": [CLIENT_XADES, PROVIDER_SEAL],
        "auth_fields": [
            _field("username", "Kullanıcı Adı"),
            _field("password", "Parola", type_="password", secret=True),
        ],
    },
    {
        "key": "izibiz",
        "display_name": "İzibiz",
        "kind": "soap",
        "supported_families": [EFATURA, EARSIV],
        "environments": ["test", "prod"],
        "signing_modes": [CLIENT_XADES, PROVIDER_SEAL],
        "auth_fields": [
            _field("username", "Kullanıcı Adı"),
            _field("password", "Parola", type_="password", secret=True),
        ],
    },
    {
        "key": "medula",
        "display_name": "Medula (SGK)",
        "kind": "soap",
        "supported_families": [ERECETE],
        "environments": ["test", "prod"],
        "signing_modes": [CLIENT_XADES],
        "auth_fields": [
            _field("username", "Medula Kullanıcı"),
            _field("password", "Medula Parola", type_="password", secret=True),
            _field("tesis_kodu", "Tesis Kodu"),
        ],
    },
]

PROVIDER_BY_KEY = {p["key"]: p for p in PROVIDER_CATALOG}


def provider_meta(provider_key: str) -> dict | None:
    return PROVIDER_BY_KEY.get(provider_key)


def secret_field_names(provider_key: str) -> set[str]:
    meta = provider_meta(provider_key)
    if not meta:
        return set()
    return {f["name"] for f in meta["auth_fields"] if f.get("secret")}


def family_for_document_type(document_type: str) -> str:
    return document_type
