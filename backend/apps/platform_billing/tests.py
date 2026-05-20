from __future__ import annotations

from datetime import date, datetime
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
    billing_period_dates,
    can_generate_subscription_invoice,
    compute_tax_lines,
    generate_invoices_for_all_tenants,
    generate_subscription_invoice,
    mark_invoice_paid,
)
from apps.platform_billing.services.pricing_service import (
    effective_monthly_discount,
    effective_yearly_discount,
    resolve_module_prices,
)
from apps.tenants.models import TenantModuleSubscription
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

    def _set_tenant_created_at(self, tenant: Tenant, when: datetime) -> None:
        aware = timezone.make_aware(when) if timezone.is_naive(when) else when
        Tenant.objects.filter(pk=tenant.pk).update(created_at=aware)
        tenant.refresh_from_db()

    def test_monthly_period_from_registration_anchor(self):
        self._set_tenant_created_at(self.tenant, datetime(2024, 1, 15, 10, 0, 0))
        start, end = billing_period_dates(self.tenant, reference=date(2026, 3, 20))
        self.assertEqual(start, date(2026, 3, 15))
        self.assertEqual(end, date(2026, 4, 14))

    def test_monthly_period_before_anchor_in_month(self):
        self._set_tenant_created_at(self.tenant, datetime(2024, 1, 15, 10, 0, 0))
        start, end = billing_period_dates(self.tenant, reference=date(2026, 3, 10))
        self.assertEqual(start, date(2026, 2, 15))
        self.assertEqual(end, date(2026, 3, 14))

    def test_yearly_period_from_registration_anchor(self):
        self.tenant.billing_period = Tenant.BillingPeriod.YEARLY
        self.tenant.save()
        self._set_tenant_created_at(self.tenant, datetime(2024, 3, 15, 10, 0, 0))
        start, end = billing_period_dates(self.tenant, reference=date(2026, 6, 1))
        self.assertEqual(start, date(2026, 3, 15))
        self.assertEqual(end, date(2027, 3, 14))

    def test_generate_invoice_line_count(self):
        invoice = generate_subscription_invoice(self.tenant)
        self.assertEqual(invoice.lines.count(), 3)
        self.assertEqual(invoice.status, TenantSubscriptionInvoice.Status.ISSUED)
        self.assertIsNotNone(invoice.subtotal_before_discount)
        self.assertEqual(invoice.discount_percent, Decimal("0"))

    def test_detail_serializer_includes_lines(self):
        from apps.platform_billing.serializers import TenantSubscriptionInvoiceDetailSerializer

        invoice = generate_subscription_invoice(self.tenant)
        data = TenantSubscriptionInvoiceDetailSerializer(invoice).data
        self.assertIn("lines", data)
        self.assertEqual(len(data["lines"]), 3)
        self.assertIn("description", data["lines"][0])

    def test_cannot_generate_duplicate_period_invoice(self):
        generate_subscription_invoice(self.tenant)
        self.assertFalse(can_generate_subscription_invoice(self.tenant))
        with self.assertRaises(ValueError):
            generate_subscription_invoice(self.tenant)

    def test_generate_invoices_for_all_tenants_skips_existing(self):
        generate_subscription_invoice(self.tenant)
        result = generate_invoices_for_all_tenants()
        self.assertEqual(result["created"], 0)
        self.assertGreaterEqual(result["skipped"], 1)

    def test_monthly_invoice_discount_snapshot(self):
        self.tenant.monthly_discount_percent = Decimal("10")
        self.tenant.save()
        invoice = generate_subscription_invoice(self.tenant)
        self.assertEqual(invoice.discount_percent, Decimal("10"))
        self.assertGreater(invoice.discount_amount, Decimal("0"))

    def test_tenant_module_price_override(self):
        slug = ALL_MODULES[0]
        ModulePrice.objects.filter(module_slug=slug).delete()
        sub = TenantModuleSubscription.objects.get(tenant=self.tenant, module_slug=slug)
        sub.price_per_user_monthly = Decimal("250")
        sub.save()
        prices = resolve_module_prices(self.tenant, [slug])
        self.assertEqual(prices[slug], Decimal("250"))

    def test_resolve_prices_requires_global_or_override(self):
        slug = ALL_MODULES[0]
        ModulePrice.objects.filter(module_slug=slug).delete()
        TenantModuleSubscription.objects.filter(
            tenant=self.tenant, module_slug=slug
        ).update(price_per_user_monthly=None)
        with self.assertRaises(ValueError):
            resolve_module_prices(self.tenant, [slug])

    def test_yearly_invoice_discount_snapshot(self):
        self.tenant.billing_period = Tenant.BillingPeriod.YEARLY
        self.tenant.yearly_discount_percent = Decimal("10")
        self.tenant.save()
        invoice = generate_subscription_invoice(self.tenant)
        self.assertEqual(invoice.discount_percent, Decimal("10"))
        self.assertGreater(invoice.subtotal_before_discount, invoice.subtotal_excl_tax)
        self.assertGreater(invoice.discount_amount, Decimal("0"))
        line = invoice.lines.first()
        self.assertIsNotNone(line.unit_price_list)
        self.assertGreater(line.line_total_before_discount, line.amount_excl_tax)

    def test_mark_paid(self):
        invoice = generate_subscription_invoice(self.tenant)
        mark_invoice_paid(invoice)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, TenantSubscriptionInvoice.Status.PAID)
        self.assertIsNotNone(invoice.paid_at)

    def test_mark_paid_sets_issued_at_when_missing(self):
        invoice = generate_subscription_invoice(self.tenant, issue=False)
        invoice.issued_at = None
        invoice.save(update_fields=["issued_at"])
        mark_invoice_paid(invoice)
        invoice.refresh_from_db()
        self.assertIsNotNone(invoice.issued_at)
        self.assertIsNotNone(invoice.document_datetime)

    def test_parse_tcmb_xml(self):
        rates = parse_tcmb_today_xml(SAMPLE_TCMB)
        self.assertEqual(rates["EUR"], Decimal("35.10"))
        self.assertEqual(rates["GBP"], Decimal("41.20"))
