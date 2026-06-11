from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import serializers

from apps.accounts.models import Department, Permission
from apps.common.password_policy import validate_password_policy
from apps.common.permission_codes import (
    ALL_MODULES,
    BILLABLE_MODULES,
    NON_BILLABLE_MODULES,
    PERMISSION_CODENAMES,
    merge_tenant_modules,
)
from apps.platform_billing.models import Currency
from apps.tenants.models import Tenant
from apps.tenants.serializers import TenantProfileSerializer
from apps.tenants.subscription_service import (
    apply_module_prices,
    set_module_subscriptions,
    tenant_module_parents,
    validate_module_parents,
)

User = get_user_model()


class PlatformModuleCatalogSerializer(serializers.Serializer):
    """One assignable module as advertised to the platform admin UI."""

    slug = serializers.CharField()
    label = serializers.CharField()
    is_billable = serializers.BooleanField()
    is_default_non_billable = serializers.BooleanField()
    default_price_per_user_monthly = serializers.CharField(allow_null=True)


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
    non_billable_modules = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
        help_text="Enabled module slugs excluded from subscription invoices (defaults are always non-billable).",
    )
    module_parents = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        help_text='Optional parent module per child slug, e.g. {"patients": "customers"}.',
    )
    module_subscriptions = serializers.SerializerMethodField(read_only=True)
    module_prices = serializers.DictField(
        child=serializers.CharField(allow_null=True),
        required=False,
        write_only=True,
        help_text='Per-module TRY/user/month override, e.g. {"products": "120.00", "billing": null}',
    )
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
            "non_billable_modules",
            "module_parents",
            "module_subscriptions",
            "billing_period",
            "payment_currency",
            "monthly_discount_percent",
            "yearly_discount_percent",
            "billing_anchor_day",
            "module_prices",
            "initial_admin_email",
            "initial_admin_password",
        )

    def get_module_subscriptions(self, obj: Tenant) -> list[dict]:
        return [
            {
                "module_slug": s.module_slug,
                "is_active": s.is_active,
                "is_extra": s.is_extra,
                "is_billable": s.is_billable,
                "parent_module_slug": s.parent_module_slug,
                "price_per_user_monthly": (
                    str(s.price_per_user_monthly) if s.price_per_user_monthly is not None else None
                ),
                "activated_at": s.activated_at,
                "expires_at": s.expires_at,
            }
            for s in obj.module_subscriptions.order_by("module_slug")
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["active_user_count"] = instance.active_user_count()
        enabled = list(instance.enabled_modules or [])
        data["default_non_billable_modules"] = list(NON_BILLABLE_MODULES)
        data["subscribed_modules"] = [m for m in enabled if m not in NON_BILLABLE_MODULES]
        data["non_billable_modules"] = [
            s.module_slug
            for s in instance.module_subscriptions.filter(is_active=True, is_billable=False)
            if s.module_slug not in NON_BILLABLE_MODULES
        ]
        data["module_parents"] = tenant_module_parents(instance)
        return data

    def validate_customer_code(self, value):
        code = value.strip()
        if not code:
            raise serializers.ValidationError("Customer code is required.")
        return code

    def validate_discount_percent(self, value):
        if value is not None and (value < 0 or value > 100):
            raise serializers.ValidationError("Must be between 0 and 100.")
        return value

    def validate_monthly_discount_percent(self, value):
        return self.validate_discount_percent(value)

    def validate_yearly_discount_percent(self, value):
        return self.validate_discount_percent(value)

    def validate_module_prices(self, value):
        if not value:
            return {}
        parsed: dict[str, Decimal | None] = {}
        for slug, raw in value.items():
            if raw is None or raw == "":
                parsed[slug] = None
                continue
            try:
                parsed[slug] = Decimal(str(raw))
            except (InvalidOperation, ValueError) as exc:
                raise serializers.ValidationError(
                    {slug: "Invalid decimal price."}
                ) from exc
            if parsed[slug] is not None and parsed[slug] < 0:
                raise serializers.ValidationError({slug: "Price must be non-negative."})
        invalid = [s for s in parsed if s not in ALL_MODULES]
        if invalid:
            raise serializers.ValidationError(
                f"Unknown modules: {', '.join(invalid)}"
            )
        return parsed

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
        modules = self._validate_module_list(value, "subscribed_modules")
        non_billable_in_payload = [m for m in modules if m in NON_BILLABLE_MODULES]
        if non_billable_in_payload:
            raise serializers.ValidationError(
                {
                    "subscribed_modules": (
                        "Non-billable modules cannot be changed: "
                        f"{', '.join(non_billable_in_payload)}"
                    )
                }
            )
        return modules

    def validate_non_billable_modules(self, value):
        modules = self._validate_module_list(value, "non_billable_modules")
        invalid = [m for m in modules if m in NON_BILLABLE_MODULES]
        if invalid:
            raise serializers.ValidationError(
                {
                    "non_billable_modules": (
                        "Default modules are always non-billable: "
                        f"{', '.join(invalid)}"
                    )
                }
            )
        return modules

    def validate_extra_modules(self, value):
        return self._validate_module_list(value, "extra_modules")

    def validate_module_parents(self, value):
        if not value:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("module_parents must be an object.")
        return value

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
        non_billable = set(attrs.get("non_billable_modules") or [])
        if subscribed is not None and extra - set(subscribed):
            raise serializers.ValidationError(
                {"extra_modules": "Extra modules must be included in subscribed_modules."}
            )
        if subscribed is not None and non_billable - set(subscribed):
            raise serializers.ValidationError(
                {
                    "non_billable_modules": (
                        "Non-billable modules must be included in subscribed_modules."
                    )
                }
            )
        module_parents = attrs.get("module_parents")
        if module_parents is not None:
            modules = merge_tenant_modules(
                subscribed
                if subscribed is not None
                else list(self.instance.enabled_modules or [])
                if self.instance
                else list(BILLABLE_MODULES)
            )
            validate_module_parents(modules, module_parents)
        return attrs

    def _apply_module_subscriptions(self, tenant: Tenant, attrs: dict) -> None:
        subscribed = attrs.pop("subscribed_modules", None)
        extra = set(attrs.pop("extra_modules", None) or [])
        if subscribed is None and "enabled_modules" in attrs:
            subscribed = attrs.get("enabled_modules")
        if subscribed is not None:
            set_module_subscriptions(
                tenant, merge_tenant_modules(subscribed), extra_modules=extra
            )

    @transaction.atomic
    def create(self, validated_data):
        admin_email = validated_data.pop("initial_admin_email").strip().lower()
        admin_password = validated_data.pop("initial_admin_password")
        subscribed = validated_data.pop("subscribed_modules", None)
        extra = set(validated_data.pop("extra_modules", []) or [])
        non_billable = set(validated_data.pop("non_billable_modules", []) or [])
        module_parents = validated_data.pop("module_parents", None) or {}
        module_prices = validated_data.pop("module_prices", None)
        validated_data.pop("enabled_modules", None)
        validated_data.setdefault("max_users", 5)
        validated_data.setdefault("billing_period", Tenant.BillingPeriod.MONTHLY)

        tenant = Tenant.objects.create(**validated_data)
        modules = merge_tenant_modules(
            subscribed if subscribed is not None else list(BILLABLE_MODULES)
        )
        set_module_subscriptions(
            tenant,
            modules,
            extra_modules=extra,
            non_billable_modules=non_billable,
            module_prices=module_prices,
            module_parents=module_parents,
        )

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
        non_billable = validated_data.pop("non_billable_modules", None)
        module_parents = validated_data.pop("module_parents", None)
        module_prices = validated_data.pop("module_prices", None)
        validated_data.pop("enabled_modules", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if subscribed is not None:
            set_module_subscriptions(
                instance,
                merge_tenant_modules(subscribed),
                extra_modules=set(extra or []),
                non_billable_modules=set(non_billable or []),
                module_prices=module_prices,
                module_parents=module_parents if module_parents is not None else {},
            )
        elif module_parents is not None:
            set_module_subscriptions(
                instance,
                list(instance.enabled_modules or []),
                module_parents=module_parents,
            )
        elif module_prices:
            apply_module_prices(instance, module_prices)
        return instance
