from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.serializers import LoginSerializer, UserSerializer
from apps.accounts.tokens import build_tokens_for_user

User = get_user_model()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]
        refresh, access = build_tokens_for_user(user)
        perm_codenames = sorted(user.effective_permission_codenames())
        return Response(
            {
                "access": access,
                "refresh": refresh,
                "user": UserSerializer(user).data,
                "permissions": perm_codenames,
                "enabled_modules": user.tenant.enabled_modules or [],
                "default_language": user.tenant.default_language,
                "module_labels": user.tenant.module_labels or {},
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh = request.data.get("refresh")
        if refresh:
            try:
                token = RefreshToken(refresh)
                token.blacklist()
            except Exception:
                pass
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        perm_codenames = sorted(user.effective_permission_codenames())
        return Response(
            {
                "user": UserSerializer(user).data,
                "permissions": perm_codenames,
                "enabled_modules": user.tenant.enabled_modules or [],
                "default_language": user.tenant.default_language,
                "module_labels": user.tenant.module_labels or {},
            }
        )


class TenantTokenRefreshSerializer(TokenRefreshSerializer):
    """Re-annotate access token with tenant claims after refresh."""

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs["refresh"])
        user = User.all_tenants.get(pk=refresh["user_id"])
        access = refresh.access_token
        from apps.accounts.tokens import TenantTokenMixin

        TenantTokenMixin.annotate_token(access, user)
        data["access"] = str(access)
        return data


class TenantTokenRefreshView(TokenRefreshView):
    serializer_class = TenantTokenRefreshSerializer
