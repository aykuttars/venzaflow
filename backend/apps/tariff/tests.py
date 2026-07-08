from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.oral.models import ProcedureCatalog
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions
from apps.tariff.models import DentalTariff, DentalTariffItem
from apps.tariff.services.parser import parse_tariff_text
from apps.tariff.services.validation import list_procedure_violations

SAMPLE_TEXT = """
 1                                   TEŞHİS VE TEDAVİ PLANLAMASI                           KDV Hariç   KDV Dahil %10
 1-1   Dişhekimi Muayenesi                                                                  1.500,00      1.650,00
 1-14   Diş Röntgen Filmi (Periapikal)                                                        754,55        830,00
 2                                       TEDAVİ VE ENDODONTİ                               KDV Hariç   KDV Dahil %10
2-4    Kompozit Dolgu (Bir Yüzlü)                                                           3.068,18     3.375,00
2-27   Kanal Tedavisi - Tek Kanal (Dolgu Hariç)                                                4.190,91      4.610,00
"""


class TariffParserTests(TestCase):
    def test_parse_tariff_text(self):
        items = parse_tariff_text(SAMPLE_TEXT)
        self.assertEqual(len(items), 4)
        codes = {item.code for item in items}
        self.assertIn("1-1", codes)
        self.assertIn("2-4", codes)
        fill = next(i for i in items if i.code == "2-4")
        self.assertEqual(fill.price_incl_vat, Decimal("3375.00"))


class TariffFloorPriceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Permission.objects.get_or_create(codename="oral.read", defaults={"name": "oral.read"})
        Permission.objects.get_or_create(codename="oral.write", defaults={"name": "oral.write"})
        cls.tenant = Tenant.objects.create(
            customer_code="TAR1",
            name="Tariff Clinic",
            enabled_modules=["oral", "patients"],
        )
        set_module_subscriptions(cls.tenant, ["oral", "patients"])
        cls.dept = Department.objects.create(tenant=cls.tenant, key="admin", name="Admin")
        cls.dept.permissions.set(Permission.objects.filter(codename__in=["oral.read", "oral.write"]))
        from django.contrib.auth import get_user_model

        User = get_user_model()
        cls.user = User.all_tenants.create(
            tenant=cls.tenant,
            email="doc@tar1.test",
            department=cls.dept,
            is_active=True,
        )
        cls.user.set_password("TestPass123!@#X")
        cls.user.save()
        cls.tariff = DentalTariff.objects.create(
            year=2026,
            title="2026 Test",
            is_active=True,
        )
        cls.item = DentalTariffItem.objects.create(
            tariff=cls.tariff,
            section_no=2,
            section_name="TEDAVİ VE ENDODONTİ",
            code="2-4",
            name="Kompozit Dolgu (Bir Yüzlü)",
            price_excl_vat=Decimal("3068.18"),
            price_incl_vat=Decimal("3375.00"),
        )

    def setUp(self):
        self.client = APIClient()

    def _login(self):
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "TAR1", "email": "doc@tar1.test", "password": "TestPass123!@#X"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["access"]

    def test_procedure_below_floor_rejected(self):
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/oral/procedures/",
            {
                "code": "FILL-TEST",
                "name": "Test Dolgu",
                "category": "treatment",
                "default_price": "1000.00",
                "tariff_item": self.item.pk,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)
        self.assertIn("default_price", r.json())

    def test_procedure_at_or_above_floor_accepted(self):
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/oral/procedures/",
            {
                "code": "FILL-OK",
                "name": "Test Dolgu OK",
                "category": "treatment",
                "default_price": "4000.00",
                "tariff_item": self.item.pk,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)

    def test_violations_endpoint(self):
        ProcedureCatalog.objects.create(
            tenant=self.tenant,
            code="BAD",
            name="Below floor",
            category="treatment",
            default_price=Decimal("1000.00"),
            tariff_item=self.item,
        )
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/tariff/violations/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["count"], 1)

    def test_list_procedure_violations_service(self):
        ProcedureCatalog.objects.create(
            tenant=self.tenant,
            code="BAD2",
            name="Below floor 2",
            category="treatment",
            default_price=Decimal("500.00"),
            tariff_item=self.item,
        )
        violations = list_procedure_violations(self.tenant.pk)
        self.assertEqual(len(violations), 1)
        self.assertEqual(violations[0]["tariff_code"], "2-4")
