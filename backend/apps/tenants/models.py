from __future__ import annotations

from django.db import models

from apps.tenants.context import get_current_tenant_id


class Tenant(models.Model):
    """Company / tenant root. Lives in shared schema (not TenantOwnedModel)."""

    class Language(models.TextChoices):
        TR = "tr", "Türkçe"
        EN = "en", "English"

    customer_code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    default_language = models.CharField(
        max_length=5,
        choices=Language.choices,
        default=Language.TR,
        help_text="Default UI and API message language for this tenant.",
    )
    is_active = models.BooleanField(default=True)
    enabled_modules = models.JSONField(
        default=list,
        help_text="Module slugs this tenant can use, e.g. ['products', 'billing'].",
    )
    module_labels = models.JSONField(
        default=dict,
        blank=True,
        help_text='Display names keyed by module slug, e.g. {"customers": "Hastalar"}.',
    )
    max_users = models.PositiveIntegerField(
        default=5,
        help_text="Maximum active staff users allowed for this tenant.",
    )

    class BillingPeriod(models.TextChoices):
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    billing_period = models.CharField(
        max_length=16,
        choices=BillingPeriod.choices,
        default=BillingPeriod.MONTHLY,
    )
    payment_currency = models.ForeignKey(
        "platform_billing.Currency",
        on_delete=models.PROTECT,
        related_name="tenants",
        null=True,
        blank=True,
    )
    monthly_discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Override platform default monthly discount; null uses global setting.",
    )
    yearly_discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Override platform default yearly discount; null uses global setting.",
    )
    billing_anchor_day = models.PositiveSmallIntegerField(
        default=1,
        help_text="Day of month (1-28) for billing period anchor.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant"
        ordering = ["customer_code"]

    def __str__(self) -> str:
        return f"{self.customer_code} — {self.name}"

    def active_user_count(self) -> int:
        from django.contrib.auth import get_user_model

        User = get_user_model()
        return User.all_tenants.filter(tenant_id=self.pk, is_active=True).count()

    def can_add_user(self) -> bool:
        return self.active_user_count() < self.max_users

    def sync_enabled_modules_from_subscriptions(self) -> None:
        slugs = list(
            self.module_subscriptions.filter(is_active=True)
            .order_by("module_slug")
            .values_list("module_slug", flat=True)
        )
        self.enabled_modules = slugs
        self.save(update_fields=["enabled_modules", "updated_at"])

    def subscription_payload(self) -> dict:
        return {
            "max_users": self.max_users,
            "active_users": self.active_user_count(),
            "subscribed_modules": list(self.enabled_modules or []),
        }


class TenantModuleSubscription(models.Model):
    """Per-tenant module entitlement (subscription row for future billing)."""

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name="module_subscriptions",
    )
    module_slug = models.CharField(max_length=64)
    is_active = models.BooleanField(default=True)
    is_extra = models.BooleanField(
        default=False,
        help_text="Granted beyond the base package by platform admin.",
    )
    activated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    price_per_user_monthly = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="TRY per user per month override; null uses global ModulePrice.",
    )

    class Meta:
        db_table = "tenant_module_subscription"
        unique_together = [("tenant", "module_slug")]
        ordering = ["tenant_id", "module_slug"]

    def __str__(self) -> str:
        return f"{self.tenant.customer_code}:{self.module_slug}"


class TenantScopedManager(models.Manager):
    """Default manager: filters to current tenant when set."""

    def get_queryset(self):
        qs = super().get_queryset()
        tenant_id = get_current_tenant_id()
        if tenant_id is not None:
            return qs.filter(tenant_id=tenant_id)
        return qs


class AllTenantsManager(models.Manager):
    """Bypass tenant filter (admin, seeds, migrations)."""

    def get_queryset(self):
        return super().get_queryset()


class TenantOwnedModel(models.Model):
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.PROTECT,
        related_name="%(class)s_set",
        db_index=True,
    )

    objects = TenantScopedManager()
    all_tenants = AllTenantsManager()

    class Meta:
        abstract = True
