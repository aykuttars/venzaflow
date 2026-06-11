from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from apps.accounts.models import Department, Permission, UserSession
from apps.accounts.rbac import (
    assert_department_manageable,
    department_manageable_by,
    filter_grantable_codenames,
    is_tenant_manager,
)
from apps.common.permission_codes import (
    codename_allowed_for_tenant,
    filter_codenames_for_tenant,
)

User = get_user_model()


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ("id", "codename", "name")


class DepartmentSerializer(serializers.ModelSerializer):
    """Lists permission codenames; writes accept the same list."""

    permission_codenames = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=False,
    )
    manageable = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ("id", "key", "name", "permission_codenames", "manageable")

    def get_manageable(self, instance: Department) -> bool:
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        if not actor or not actor.is_authenticated:
            return False
        return department_manageable_by(actor, instance)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        codes = list(
            instance.permissions.order_by("codename").values_list("codename", flat=True)
        )
        data["permission_codenames"] = filter_codenames_for_tenant(
            codes, instance.tenant.enabled_modules
        )
        return data

    def validate_permission_codenames(self, value):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        tenant = getattr(actor, "tenant", None)
        if not tenant:
            return value
        invalid = [c for c in value if not codename_allowed_for_tenant(c, tenant.enabled_modules)]
        if invalid:
            raise serializers.ValidationError(
                _("Permissions for unsubscribed modules are not allowed: %(codes)s")
                % {"codes": ", ".join(sorted(invalid))}
            )
        if actor:
            ungrantable = [
                c for c in value if c not in filter_grantable_codenames(actor, list(value))
            ]
            if ungrantable:
                raise serializers.ValidationError(
                    _("You cannot grant permissions you do not hold: %(codes)s")
                    % {"codes": ", ".join(sorted(ungrantable))}
                )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        actor = getattr(request, "user", None)
        instance = self.instance

        if instance and instance.key == "admin":
            if "key" in attrs and attrs["key"] != instance.key:
                raise serializers.ValidationError(
                    {"key": _("The admin department key cannot be changed.")}
                )
            codes = attrs.get("permission_codenames")
            if codes is not None and len(codes) == 0:
                raise serializers.ValidationError(
                    {"permission_codenames": _("The admin department must keep permissions.")}
                )

        if actor and actor.is_authenticated:
            proposed = attrs.get("permission_codenames")
            if instance is not None:
                assert_department_manageable(actor, instance, proposed)
            else:
                codes = proposed if proposed is not None else []
                assert_department_manageable(
                    actor,
                    Department(tenant=actor.tenant, key=attrs.get("key", "new"), name=""),
                    codes,
                )

        return attrs

    def create(self, validated_data):
        codes = validated_data.pop("permission_codenames", [])
        tenant_id = validated_data.pop("tenant_id")
        if validated_data.get("key") == "admin" and not is_tenant_manager(
            self.context["request"].user
        ):
            raise serializers.ValidationError(
                {"key": _("Only tenant managers can create an admin department.")}
            )
        dept = Department.objects.create(tenant_id=tenant_id, **validated_data)
        if codes:
            dept.permissions.set(Permission.objects.filter(codename__in=codes))
        return dept

    def update(self, instance, validated_data):
        codes = validated_data.pop("permission_codenames", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if codes is not None:
            instance.permissions.set(Permission.objects.filter(codename__in=codes))
        return instance


class UserSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    tenant_code = serializers.CharField(source="tenant.customer_code", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    tenant_default_language = serializers.CharField(
        source="tenant.default_language",
        read_only=True,
    )

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "tenant_code",
            "tenant_name",
            "tenant_default_language",
            "first_name",
            "last_name",
            "department",
            "is_active",
        )


class UserSessionSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_name = serializers.SerializerMethodField()
    is_current = serializers.SerializerMethodField()

    class Meta:
        model = UserSession
        fields = (
            "id",
            "user",
            "user_email",
            "user_name",
            "client",
            "client_version",
            "ip_address",
            "user_agent",
            "created_at",
            "last_seen_at",
            "revoked",
            "is_current",
        )
        read_only_fields = fields

    def get_user_name(self, obj: UserSession) -> str:
        return f"{obj.user.first_name} {obj.user.last_name}".strip()

    def get_is_current(self, obj: UserSession) -> bool:
        sid = self.context.get("current_sid")
        return bool(sid and obj.jti == sid)


class LoginSerializer(serializers.Serializer):
    """Authenticate with tenant customer_code + email + password (no username)."""

    customer_code = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from apps.tenants.models import Tenant

        code = attrs["customer_code"].strip()
        email = attrs["email"].strip().lower()
        password = attrs["password"]

        tenant = Tenant.objects.filter(customer_code=code, is_active=True).first()
        if not tenant:
            raise serializers.ValidationError({"detail": _("Invalid credentials.")})

        user = (
            User.all_tenants
            .filter(tenant=tenant, email__iexact=email, is_active=True)
            .first()
        )
        if not user or user.is_platform_admin or not user.check_password(password):
            raise serializers.ValidationError({"detail": _("Invalid credentials.")})
        attrs["user"] = user
        return attrs
