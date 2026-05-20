from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.platform_billing.models import (
    Currency,
    ExchangeRate,
    ModulePrice,
    PlatformBillingSettings,
    TaxRate,
    TaxType,
    TenantSubscriptionInvoice,
    TenantSubscriptionInvoiceLine,
)
from apps.tenants.models import Tenant


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = (
            "code",
            "name",
            "symbol",
            "tcmb_code",
            "decimal_places",
            "is_active",
        )


class ExchangeRateSerializer(serializers.ModelSerializer):
    currency_code = serializers.CharField(source="currency_id", read_only=True)

    class Meta:
        model = ExchangeRate
        fields = (
            "id",
            "currency_code",
            "rate_to_try",
            "source",
            "fetched_at",
        )
        read_only_fields = fields


class ManualExchangeRateSerializer(serializers.Serializer):
    currency_code = serializers.CharField(max_length=8)
    rate_to_try = serializers.DecimalField(max_digits=18, decimal_places=6, min_value=Decimal("0.000001"))


class TaxTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxType
        fields = ("id", "code", "name", "description")


class TaxRateSerializer(serializers.ModelSerializer):
    tax_type_code = serializers.CharField(source="tax_type.code", read_only=True)
    tax_type_name = serializers.CharField(source="tax_type.name", read_only=True)

    class Meta:
        model = TaxRate
        fields = (
            "id",
            "tax_type",
            "tax_type_code",
            "tax_type_name",
            "rate_percent",
            "is_active",
            "valid_from",
            "valid_to",
        )


class ModulePriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = ModulePrice
        fields = ("id", "module_slug", "price_per_user_monthly", "is_active")


class PlatformBillingSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlatformBillingSettings
        fields = (
            "yearly_discount_percent",
            "invoice_prefix",
            "default_payment_terms_days",
            "company_name",
            "company_tax_id",
            "company_address",
        )


class TenantSubscriptionInvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantSubscriptionInvoiceLine
        fields = (
            "id",
            "module_slug",
            "description",
            "user_count",
            "unit_price",
            "months",
            "amount_excl_tax",
        )


class TenantSubscriptionInvoiceSerializer(serializers.ModelSerializer):
    lines = TenantSubscriptionInvoiceLineSerializer(many=True, read_only=True)
    currency_code = serializers.CharField(source="currency_id", read_only=True)
    tenant_name = serializers.CharField(source="tenant.name", read_only=True)
    tenant_code = serializers.CharField(source="tenant.customer_code", read_only=True)
    is_paid = serializers.SerializerMethodField()

    class Meta:
        model = TenantSubscriptionInvoice
        fields = (
            "id",
            "tenant",
            "tenant_name",
            "tenant_code",
            "number",
            "period_start",
            "period_end",
            "billing_period",
            "currency_code",
            "fx_rate_to_try",
            "subtotal_excl_tax",
            "tax_lines",
            "total_incl_tax",
            "status",
            "issued_at",
            "paid_at",
            "notes",
            "is_paid",
            "lines",
            "created_at",
        )
        read_only_fields = fields

    def get_is_paid(self, obj: TenantSubscriptionInvoice) -> bool:
        return obj.status == TenantSubscriptionInvoice.Status.PAID


class GenerateInvoiceSerializer(serializers.Serializer):
    period_start = serializers.DateField(required=False)
    period_end = serializers.DateField(required=False)
    issue = serializers.BooleanField(default=True)


class MarkPaidSerializer(serializers.Serializer):
    method = serializers.CharField(max_length=64, default="bank_transfer")
    reference = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
