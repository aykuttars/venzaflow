from __future__ import annotations

from django.utils import timezone
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class TenantTokenMixin:
    @classmethod
    def annotate_token(cls, token, user):
        if user.is_platform_admin:
            token["tenant_id"] = None
            token["tenant_code"] = ""
            token["is_platform"] = True
            token["department_id"] = None
            token["department_key"] = ""
        else:
            token["tenant_id"] = user.tenant_id
            token["tenant_code"] = user.tenant.customer_code
            token["is_platform"] = False
            if user.department_id:
                token["department_id"] = user.department_id
                token["department_key"] = user.department.key
            else:
                token["department_id"] = None
                token["department_key"] = ""
        token["email"] = user.email
        return token


class PlatformTokenMixin(TenantTokenMixin):
    """Alias for platform token annotation (same mixin)."""
    pass


class TenantTokenObtainPairSerializer(TenantTokenMixin, TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        cls.annotate_token(token, user)
        return token


def build_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    TenantTokenMixin.annotate_token(refresh, user)
    TenantTokenMixin.annotate_token(refresh.access_token, user)
    return str(refresh), str(refresh.access_token)


def build_tokens_with_session(
    user,
    *,
    client: str = "web",
    client_version: str = "",
    ip_address: str | None = None,
    user_agent: str = "",
):
    """Like build_tokens_for_user but also records a UserSession and stamps a
    `sid` (session id = refresh jti) claim on both tokens so the session can be
    tracked for last-seen and revoked remotely."""
    from apps.accounts.models import UserSession

    refresh = RefreshToken.for_user(user)
    TenantTokenMixin.annotate_token(refresh, user)
    jti = refresh["jti"]

    session = UserSession.objects.create(
        user=user,
        tenant=user.tenant,
        jti=jti,
        client=client,
        client_version=client_version or "",
        ip_address=ip_address,
        user_agent=user_agent or "",
        last_seen_at=timezone.now(),
    )

    refresh["sid"] = jti
    access = refresh.access_token
    TenantTokenMixin.annotate_token(access, user)
    access["sid"] = jti
    return str(refresh), str(access), session
