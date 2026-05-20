from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.permissions import IsPlatformAdmin
from apps.accounts.serializers import UserSerializer
from apps.accounts.tokens import PlatformTokenMixin, build_tokens_for_user
from apps.common.permission_codes import PERMISSION_CODENAMES

User = get_user_model()


class PlatformLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        email = attrs["email"].strip().lower()
        password = attrs["password"]
        user = (
            User.all_tenants.filter(
                tenant__isnull=True,
                is_superuser=True,
                is_active=True,
                email__iexact=email,
            )
            .first()
        )
        if not user or not user.check_password(password):
            raise serializers.ValidationError({"detail": _("Invalid credentials.")})
        attrs["user"] = user
        return attrs


class PlatformUserSerializer(UserSerializer):
    """User payload for platform admin (no tenant)."""

    tenant_code = serializers.CharField(read_only=True, allow_null=True, default=None)
    tenant_name = serializers.CharField(read_only=True, allow_null=True, default=None)
    tenant_default_language = serializers.CharField(
        read_only=True,
        allow_null=True,
        default=None,
    )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["tenant_code"] = None
        data["tenant_name"] = None
        data["tenant_default_language"] = None
        return data


class PlatformLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = PlatformLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]
        refresh, access = build_tokens_for_user(user)
        perm_codenames = sorted(user.effective_permission_codenames())
        return Response(
            {
                "access": access,
                "refresh": refresh,
                "user": PlatformUserSerializer(user).data,
                "permissions": perm_codenames,
                "is_platform": True,
            }
        )


class PlatformMeView(APIView):
    permission_classes = [IsPlatformAdmin]

    def get(self, request):
        user = request.user
        perm_codenames = sorted(user.effective_permission_codenames())
        return Response(
            {
                "user": PlatformUserSerializer(user).data,
                "permissions": perm_codenames,
                "is_platform": True,
            }
        )


class PlatformTokenRefreshSerializer(serializers.Serializer):
    """Re-annotate access token with platform claims after refresh."""

    refresh = serializers.CharField()

    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        user = User.all_tenants.get(pk=refresh["user_id"])
        if not user.is_platform_admin:
            raise serializers.ValidationError({"detail": _("Invalid token.")})
        access = refresh.access_token
        PlatformTokenMixin.annotate_token(access, user)
        return {"access": str(access), "refresh": str(refresh)}


class PlatformTokenRefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = PlatformTokenRefreshSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data)


class PlatformLogoutView(APIView):
    permission_classes = [IsPlatformAdmin]

    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                token = RefreshToken(refresh)
                token.blacklist()
            except Exception:
                pass
        return Response(status=status.HTTP_205_RESET_CONTENT)
