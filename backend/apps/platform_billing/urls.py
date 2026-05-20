from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.platform_billing.views import (
    CurrencyViewSet,
    ExchangeRateLatestView,
    ExchangeRateManualView,
    ModulePriceViewSet,
    PlatformBillingSettingsView,
    TaxRateViewSet,
    TaxTypeViewSet,
    TenantSubscriptionInvoiceViewSet,
)

router = DefaultRouter()
router.register(r"billing/currencies", CurrencyViewSet, basename="platform-currency")
router.register(r"billing/tax-types", TaxTypeViewSet, basename="platform-tax-type")
router.register(r"billing/tax-rates", TaxRateViewSet, basename="platform-tax-rate")
router.register(r"billing/module-prices", ModulePriceViewSet, basename="platform-module-price")

tenant_invoice_list = TenantSubscriptionInvoiceViewSet.as_view({"get": "list", "post": "create"})
tenant_invoice_detail = TenantSubscriptionInvoiceViewSet.as_view({"get": "retrieve"})
tenant_invoice_mark_paid = TenantSubscriptionInvoiceViewSet.as_view({"post": "mark_paid"})
tenant_invoice_pdf = TenantSubscriptionInvoiceViewSet.as_view({"get": "pdf"})

urlpatterns = [
    path(
        "billing/exchange-rates/latest/",
        ExchangeRateLatestView.as_view(),
        name="platform-exchange-rates-latest",
    ),
    path(
        "billing/exchange-rates/manual/",
        ExchangeRateManualView.as_view(),
        name="platform-exchange-rates-manual",
    ),
    path("billing/settings/", PlatformBillingSettingsView.as_view(), name="platform-billing-settings"),
    path(
        "tenants/<int:tenant_pk>/subscription-invoices/",
        tenant_invoice_list,
        name="platform-tenant-subscription-invoices",
    ),
    path(
        "tenants/<int:tenant_pk>/subscription-invoices/<int:pk>/",
        tenant_invoice_detail,
        name="platform-tenant-subscription-invoice-detail",
    ),
    path(
        "tenants/<int:tenant_pk>/subscription-invoices/<int:pk>/mark-paid/",
        tenant_invoice_mark_paid,
        name="platform-tenant-subscription-invoice-mark-paid",
    ),
    path(
        "tenants/<int:tenant_pk>/subscription-invoices/<int:pk>/pdf/",
        tenant_invoice_pdf,
        name="platform-tenant-subscription-invoice-pdf",
    ),
] + router.urls
