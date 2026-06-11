from __future__ import annotations

from datetime import timedelta

from django.utils import timezone
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

# Throttle last-seen writes: only update once per this interval per session.
LAST_SEEN_REFRESH_SECONDS = 60


class TenantJWTAuthentication(JWTAuthentication):
    """Validate JWT, ensure `tenant_id` matches, and maintain session state.

    When the token carries a `sid` (session id) claim we refresh the session's
    last-seen timestamp (throttled) and reject tokens of revoked sessions, so an
    admin can remotely disconnect an e-signature client.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        tid = validated_token.get("tenant_id")
        if tid is not None and getattr(user, "tenant_id", None) != int(tid):
            raise InvalidToken({"detail": "Token tenant mismatch."})

        sid = validated_token.get("sid")
        if sid:
            self._touch_session(sid)
        return user

    def _touch_session(self, sid: str) -> None:
        from apps.accounts.models import UserSession

        session = UserSession.objects.filter(jti=sid).only(
            "id", "revoked", "last_seen_at"
        ).first()
        if not session:
            return
        if session.revoked:
            raise InvalidToken({"detail": "Session revoked."})
        now = timezone.now()
        if (
            session.last_seen_at is None
            or session.last_seen_at < now - timedelta(seconds=LAST_SEEN_REFRESH_SECONDS)
        ):
            UserSession.objects.filter(pk=session.pk).update(last_seen_at=now)
