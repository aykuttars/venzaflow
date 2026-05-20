from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.common.permission_codes import ALL_MODULES
from apps.platform_billing.models import (
    Currency,
    ExchangeRate,
    ModulePrice,
    PlatformBillingSettings,
    TaxRate,
    TaxType,
    TenantSubscriptionInvoice,
)
from apps.platform_billing.services.invoice_service import (
    compute_tax_lines,
    effective_yearly_discount,
    generate_subscription_invoice,
    mark_invoice_paid,
)
from apps.platform_billing.services.fx_service import convert_try_to_currency
from apps.platform_billing.services.tcmb import parse_tcmb_today_xml
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()

SAMPLE_TCMB = b"""<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date>
  <Currency CurrencyCode="USD">
    <ForexSelling>32.50</ForexSelling>
  </Currency>
  <Currency CurrencyCode="EUR">
    <ForexSelling>35.10</ForexSelling>
  </Currency>
  <Currency CurrencyCode="GBP">
    <ForexSelling>41.20</ForexSelling>
  </Currency>
</Tarih_Date>
"""


class PlatformBillingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.try_cur, _ = Currency.objects.get_or_create(
            code="TRY",
            defaults={"name": "Turkish Lira", "symbol": "₺", "decimal_places": 2},
        )
        cls.eur, _ = Currency.objects.get_or_create(
            code="EUR",
            defaults={
                "name": "Euro",
                "symbol": "€",
                "tcmb_code": "EUR",
                "decimal_places": 2,
            },
        )
        TaxType.objects.get_or_create(code="KDV", defaults={"name": "KDV"})
        tax_type = TaxType.objects.get(code="KDV")
        TaxRate.objects.get_or_create(
            tax_type=tax_type,
            rate_percent=Decimal("20"),
            valid_from=date(2020, 1, 1),
            defaults={"is_active": True},
        )
        PlatformBillingSettings.objects.get_or_create(pk=1)
        for slug in ALL_MODULES[:3]:
            ModulePrice.objects.get_or_create(
                module_slug=slug,
                defaults={"price_per_user_monthly": Decimal("100.00")},
            )

    def setUp(self):
        self.tenant = Tenant.objects.create(
            customer_code="PBTEST",
            name="Billing Test",
            payment_currency=self.try_cur,
            billing_period=Tenant.BillingPeriod.MONTHLY,
        )
        set_module_subscriptions(self.tenant, list(ALL_MODULES[:3]))
        ExchangeRate.objects.create(
            currency=self.try_cur,
            rate_to_try=Decimal("1"),
            source=ExchangeRate.Source.MANUAL,
            fetched_at=timezone.now(),
        )
        dept = None
        from apps.accounts.models import Department

        dept, _ = Department.objects.get_or_create(
            tenant=self.tenant, key="admin", defaults={"name": "Admin"}
        )
        u = User(
            tenant=self.tenant,
            email="bill@test.com",
            department=dept,
            is_active=True,
        )
        u.set_password("test-pass-123!")
        u.save()

    def test_yearly_discount_uses_tenant_override(self):
        self.tenant.yearly_discount_percent = Decimal("10")
        self.tenant.billing_period = Tenant.BillingPeriod.YEARLY
        self.tenant.save()
        self.assertEqual(effective_yearly_discount(self.tenant), Decimal("10"))

    def test_convert_try_to_eur(self):
        ExchangeRate.objects.create(
            currency=self.eur,
            rate_to_try=Decimal("35"),
            source=ExchangeRate.Source.MANUAL,
            fetched_at=timezone.now(),
        )
        result = convert_try_to_currency(Decimal("350"), Decimal("35"))
        self.assertEqual(result, Decimal("10.0000"))

    def test_compute_tax_lines_kdv(self):
        lines, total = compute_tax_lines(Decimal("1000"))
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["tax_type_code"], "KDV")
        self.assertEqual(total, Decimal("200.00"))

    def test_generate_invoice_line_count(self):
        invoice = generate_subscription_invoice(self.tenant)
        self.assertEqual(invoice.lines.count(), 3)
        self.assertEqual(invoice.status, TenantSubscriptionInvoice.Status.ISSUED)

    def test_mark_paid(self):
        invoice = generate_subscription_invoice(self.tenant)
        mark_invoice_paid(invoice)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, TenantSubscriptionInvoice.Status.PAID)
        self.assertIsNotNone(invoice.paid_at)

    def test_parse_tcmb_xml(self):
        rates = parse_tcmb_today_xml(SAMPLE_TCMB)
        self.assertEqual(rates["EUR"], Decimal("35.10"))
        self.assertEqual(rates["GBP"], Decimal("41.20"))
