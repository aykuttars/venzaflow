from __future__ import annotations

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class TenantTokenMixin:
    @classmethod
    def annotate_token(cls, token, user):
        token["tenant_id"] = user.tenant_id
        token["tenant_code"] = user.tenant.customer_code
        if user.department_id:
            token["department_id"] = user.department_id
            token["department_key"] = user.department.key
        else:
            token["department_id"] = None
            token["department_key"] = ""
        token["email"] = user.email
        return token


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
