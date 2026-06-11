"""Symmetric encryption for integrator credentials stored at rest.

Credentials (API keys, integrator passwords) are encrypted with Fernet so a
database leak does not expose secrets in plaintext. The key comes from
settings.AUTHORITY_ENCRYPTION_KEY; in dev it is derived from SECRET_KEY so the
stack works without extra configuration. Rotate by setting an explicit key.
"""

from __future__ import annotations

import base64
import hashlib
import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = (getattr(settings, "AUTHORITY_ENCRYPTION_KEY", "") or "").strip()
    if not key:
        digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(digest).decode("ascii")
    # Accept either a ready Fernet key or any string we can coerce to 32 bytes.
    try:
        return Fernet(key)
    except (ValueError, TypeError):
        digest = hashlib.sha256(key.encode("utf-8")).digest()
        return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_json(data: dict[str, Any]) -> str:
    raw = json.dumps(data, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return _fernet().encrypt(raw).decode("ascii")


def decrypt_json(token: str) -> dict[str, Any]:
    if not token:
        return {}
    try:
        raw = _fernet().decrypt(token.encode("ascii"))
    except (InvalidToken, ValueError):
        return {}
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError:
        return {}


def mask_secret(value: str, *, keep: int = 4) -> str:
    """Return a masked hint like '••••2f9a' for display, never the secret."""
    if not value:
        return ""
    tail = value[-keep:] if len(value) > keep else value
    return f"••••{tail}"
