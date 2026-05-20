from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Department, Permission
from apps.common.password_policy import validate_password_policy
from apps.common.permission_codes import ALL_MODULES, PERMISSION_CODENAMES
from apps.platform_billing.models import Currency
from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantProfileSerializer
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class PlatformTenantSerializer(TenantProfileSerializer):
    initial_admin_email = serializers.EmailField(write_only=True, required=False)
    initial_admin_password = serializers.CharField(write_only=True, required=False)
    active_user_count = serializers.IntegerField(read_only=True)
    subscribed_modules = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
    )
    extra_modules = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
        help_text="Module slugs marked as extra (beyond base package).",
    )
    module_subscriptions = serializers.SerializerMethodField(read_only=True)
    payment_currency = serializers.SlugRelatedField(
        slug_field="code",
        queryset=Currency.objects.filter(is_active=True),
        required=False,
        allow_null=True,
    )

    class Meta(TenantProfileSerializer.Meta):
        read_only_fields = ("id", "enabled_modules")
        fields = TenantProfileSerializer.Meta.fields + (
            "max_users",
            "active_user_count",
            "subscribed_modules",
            "extra_modules",
            "module_subscriptions",
            "billing_period",
            "payment_currency",
            "yearly_discount_percent",
            "billing_anchor_day",
            "initial_admin_email",
            "initial_admin_password",
        )

    def get_module_subscriptions(self, obj: Tenant) -> list[dict]:
        return [
            {
                "module_slug": s.module_slug,
                "is_active": s.is_active,
                "is_extra": s.is_extra,
                "activated_at": s.activated_at,
                "expires_at": s.expires_at,
            }
            for s in obj.module_subscriptions.order_by("module_slug")
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["active_user_count"] = instance.active_user_count()
        data["subscribed_modules"] = list(instance.enabled_modules or [])
        return data

    def validate_customer_code(self, value):
        code = value.strip()
        if not code:
            raise serializers.ValidationError("Customer code is required.")
        return code

    def validate_yearly_discount_percent(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Must be between 0 and 100.")
        return value

    def validate_billing_anchor_day(self, value):
        if value is not None and (value < 1 or value > 28):
            raise serializers.ValidationError("Must be between 1 and 28.")
        return value

    def validate_max_users(self, value):
        if value < 1:
            raise serializers.ValidationError("max_users must be at least 1.")
        if self.instance and value < self.instance.active_user_count():
            raise serializers.ValidationError(
                "max_users cannot be less than current active user count."
            )
        return value

    def _validate_module_list(self, value, field_name: str) -> list[str]:
        if value is None:
            return []
        allowed = set(ALL_MODULES)
        invalid = [m for m in value if m not in allowed]
        if invalid:
            raise serializers.ValidationError(
                {field_name: f"Unknown modules: {', '.join(invalid)}"}
            )
        return list(dict.fromkeys(value))

    def validate_subscribed_modules(self, value):
        return self._validate_module_list(value, "subscribed_modules")

    def validate_extra_modules(self, value):
        return self._validate_module_list(value, "extra_modules")

    def validate_enabled_modules(self, value):
        if value is None:
            return []
        return self._validate_module_list(value, "enabled_modules")

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
            if attrs.get("max_users", 5) < 1:
                raise serializers.ValidationError({"max_users": "Must be at least 1."})
        elif "initial_admin_email" in attrs or "initial_admin_password" in attrs:
            raise serializers.ValidationError(
                "Initial admin credentials can only be set when creating a tenant."
            )

        subscribed = attrs.get("subscribed_modules")
        extra = set(attrs.get("extra_modules") or [])
        if subscribed is not None and extra - set(subscribed):
            raise serializers.ValidationError(
                {"extra_modules": "Extra modules must be included in subscribed_modules."}
            )
        return attrs

    def _apply_module_subscriptions(self, tenant: Tenant, attrs: dict) -> None:
        subscribed = attrs.pop("subscribed_modules", None)
        extra = set(attrs.pop("extra_modules", None) or [])
        if subscribed is None and "enabled_modules" in attrs:
            subscribed = attrs.get("enabled_modules")
        if subscribed is not None:
            set_module_subscriptions(tenant, subscribed, extra_modules=extra)

    @transaction.atomic
    def create(self, validated_data):
        admin_email = validated_data.pop("initial_admin_email").strip().lower()
        admin_password = validated_data.pop("initial_admin_password")
        subscribed = validated_data.pop("subscribed_modules", None)
        extra = set(validated_data.pop("extra_modules", []) or [])
        validated_data.pop("enabled_modules", None)
        validated_data.setdefault("max_users", 5)
        validated_data.setdefault("billing_period", Tenant.BillingPeriod.MONTHLY)

        tenant = Tenant.objects.create(**validated_data)
        modules = subscribed if subscribed is not None else list(ALL_MODULES)
        set_module_subscriptions(tenant, modules, extra_modules=extra)

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

    @transaction.atomic
    def update(self, instance, validated_data):
        subscribed = validated_data.pop("subscribed_modules", None)
        extra = validated_data.pop("extra_modules", None)
        validated_data.pop("enabled_modules", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if subscribed is not None:
            set_module_subscriptions(
                instance,
                subscribed,
                extra_modules=set(extra or []),
            )
        return instance
