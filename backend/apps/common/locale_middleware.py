from __future__ import annotations

from django.utils import translation


def _parse_accept_language(header: str) -> str | None:
    if not header:
        return None
    for part in header.split(","):
        token = part.split(";")[0].strip().lower()
        if token.startswith("tr"):
            return "tr"
        if token.startswith("en"):
            return "en"
    return None


class RequestLocaleMiddleware:
    """
    Activates Django translation from Accept-Language (tr/en).
    Falls back to tenant default_language when user is authenticated.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        lang = _parse_accept_language(request.META.get("HTTP_ACCEPT_LANGUAGE", ""))
        if lang is None and getattr(request, "user", None) and request.user.is_authenticated:
            tenant = getattr(request.user, "tenant", None)
            if tenant and getattr(tenant, "default_language", None) in ("tr", "en"):
                lang = tenant.default_language
        if lang not in ("tr", "en"):
            lang = "tr"
        translation.activate(lang)
        request.LANGUAGE_CODE = lang
        response = self.get_response(request)
        translation.deactivate()
        return response
