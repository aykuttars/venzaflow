from __future__ import annotations

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class TenantJWTAuthentication(JWTAuthentication):
    """Validate JWT and ensure `tenant_id` claim matches the resolved user."""

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        tid = validated_token.get("tenant_id")
        if tid is not None and getattr(user, "tenant_id", None) != int(tid):
            raise InvalidToken({"detail": "Token tenant mismatch."})
        return user
