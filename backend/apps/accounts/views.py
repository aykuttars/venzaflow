from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.serializers import LoginSerializer, UserSerializer
from apps.accounts.tokens import build_tokens_with_session
from apps.common.request_meta import client_ip, client_version, detect_client, user_agent
from apps.tenants.subscription_service import tenant_has_module, tenant_module_parents

User = get_user_model()


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.validated_data["user"]

        # Optional module gate: clients tied to a specific module (e.g. the
        # e-signature desktop app) send `required_module` so tenants without
        # that subscription are rejected at login rather than after the fact.
        required_module = request.data.get("required_module")
        required_modules = request.data.get("required_modules")
        if required_modules and isinstance(required_modules, list):
            if not any(tenant_has_module(user.tenant, m) for m in required_modules):
                return Response(
                    {
                        "detail": _(
                            "Your account does not have access to the required module."
                        ),
                        "code": "module_not_enabled",
                        "modules": required_modules,
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif required_module and not tenant_has_module(user.tenant, required_module):
            return Response(
                {
                    "detail": _(
                        "Your account does not have access to the required module."
                    ),
                    "code": "module_not_enabled",
                    "module": required_module,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        refresh, access, _session = build_tokens_with_session(
            user,
            client=detect_client(request),
            client_version=client_version(request),
            ip_address=client_ip(request),
            user_agent=user_agent(request),
        )
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
                "module_parents": tenant_module_parents(user.tenant),
                "subscription": user.tenant.subscription_payload(),
            }
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.accounts.models import UserSession
        from django.utils import timezone

        refresh = request.data.get("refresh")
        revoked_jti = None
        if refresh:
            try:
                token = RefreshToken(refresh)
                revoked_jti = token.get("jti")
                token.blacklist()
            except Exception:
                pass

        # Mark the matching session revoked (prefer refresh jti, else access sid).
        sid = revoked_jti or (request.auth.get("sid") if request.auth else None)
        if sid:
            UserSession.objects.filter(jti=sid, revoked=False).update(
                revoked=True, revoked_at=timezone.now()
            )
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
                "module_parents": tenant_module_parents(user.tenant),
                "subscription": user.tenant.subscription_payload(),
            }
        )


class UserSessionListView(APIView):
    """Active login sessions for the current tenant (admins via settings.read).

    Surfaces which users are connected through the e-signature desktop app
    (client=eimza) vs the browser, with last-seen for online detection.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.accounts.models import UserSession
        from apps.accounts.serializers import UserSessionSerializer

        if not request.user.has_permission_codename("settings.read"):
            return Response(
                {"detail": _("You do not have permission to view sessions.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        qs = (
            UserSession.objects.filter(tenant_id=request.user.tenant_id, revoked=False)
            .select_related("user")
            .order_by("-last_seen_at")[:200]
        )
        current_sid = request.auth.get("sid") if request.auth else None
        data = UserSessionSerializer(
            qs, many=True, context={"current_sid": current_sid}
        ).data
        return Response(data)


class UserSessionRevokeView(APIView):
    """Revoke a session so its tokens stop working (settings.write)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from apps.accounts.models import UserSession
        from django.utils import timezone

        if not request.user.has_permission_codename("settings.write"):
            return Response(
                {"detail": _("You do not have permission to revoke sessions.")},
                status=status.HTTP_403_FORBIDDEN,
            )
        session = UserSession.objects.filter(
            pk=pk, tenant_id=request.user.tenant_id
        ).first()
        if not session:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not session.revoked:
            session.revoked = True
            session.revoked_at = timezone.now()
            session.save(update_fields=["revoked", "revoked_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class TenantTokenRefreshSerializer(TokenRefreshSerializer):
    """Re-annotate access token with tenant claims after refresh."""

    def validate(self, attrs):
        data = super().validate(attrs)
        refresh = RefreshToken(attrs["refresh"])
        user = User.all_tenants.get(pk=refresh["user_id"])
        access = refresh.access_token
        from apps.accounts.tokens import TenantTokenMixin

        TenantTokenMixin.annotate_token(access, user)
        sid = refresh.get("sid")
        if sid:
            access["sid"] = sid
        data["access"] = str(access)
        return data


class TenantTokenRefreshView(TokenRefreshView):
    serializer_class = TenantTokenRefreshSerializer
