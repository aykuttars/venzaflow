"""Helpers to extract client metadata (type, version, IP, user-agent) from a
request. Used to tag login sessions so the UI can distinguish e-signature
desktop clients from browsers."""

from __future__ import annotations

KNOWN_CLIENTS = {"web", "eimza"}


def detect_client(request) -> str:
    raw = (request.headers.get("X-Client-Id") or "").strip().lower()
    if raw in KNOWN_CLIENTS:
        return raw
    if raw:
        return "unknown"
    # No explicit client header → assume a browser.
    return "web"


def client_version(request) -> str:
    return (request.headers.get("X-Client-Version") or "").strip()[:32]


def client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        # First hop is the original client.
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def user_agent(request) -> str:
    return (request.META.get("HTTP_USER_AGENT") or "")[:1024]
