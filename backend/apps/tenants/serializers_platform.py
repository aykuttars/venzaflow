from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Department, Permission
from apps.common.password_policy import validate_password_policy
from apps.common.permission_codes import ALL_MODULES, PERMISSION_CODENAMES
from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantProfileSerializer

User = get_user_model()


class PlatformTenantSerializer(TenantProfileSerializer):
    initial_admin_email = serializers.EmailField(write_only=True, required=False)
    initial_admin_password = serializers.CharField(write_only=True, required=False)

    class Meta(TenantProfileSerializer.Meta):
        read_only_fields = ("id",)
        fields = TenantProfileSerializer.Meta.fields + (
            "initial_admin_email",
            "initial_admin_password",
        )

    def validate_customer_code(self, value):
        code = value.strip()
        if not code:
            raise serializers.ValidationError("Customer code is required.")
        return code

    def validate_enabled_modules(self, value):
        if value is None:
            return []
        allowed = set(ALL_MODULES)
        invalid = [m for m in value if m not in allowed]
        if invalid:
            raise serializers.ValidationError(
                f"Unknown modules: {', '.join(invalid)}. Allowed: {', '.join(sorted(allowed))}"
            )
        return list(dict.fromkeys(value))

    def get_extra_kwargs(self):
        kwargs = super().get_extra_kwargs()
        if self.instance is not None:
            kwargs.setdefault("customer_code", {})["read_only"] = True
        return kwargs

    def validate(self, attrs):
        if self.instance is None:
            email = attrs.get("initial_admin_email")
            password = attrs.get("initial_admin_password")
            if not email or not password:
                raise serializers.ValidationError(
                    {
                        "initial_admin_email": "Required when creating a tenant.",
                        "initial_admin_password": "Required when creating a tenant.",
                    }
                )
            validate_password_policy(password)
        elif "initial_admin_email" in attrs or "initial_admin_password" in attrs:
            raise serializers.ValidationError(
                "Initial admin credentials can only be set when creating a tenant."
            )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        admin_email = validated_data.pop("initial_admin_email").strip().lower()
        admin_password = validated_data.pop("initial_admin_password")
        tenant = Tenant.objects.create(**validated_data)

        all_perms = list(Permission.objects.all())
        if not all_perms:
            for codename, name in PERMISSION_CODENAMES:
                Permission.objects.get_or_create(codename=codename, defaults={"name": name})
            all_perms = list(Permission.objects.all())

        dept = Department.objects.create(
            tenant=tenant,
            key="admin",
            name="Admin",
        )
        dept.permissions.set(all_perms)

        admin_user = User(
            tenant=tenant,
            email=admin_email,
            department=dept,
            is_active=True,
        )
        admin_user.set_password(admin_password)
        admin_user.save()
        return tenant
