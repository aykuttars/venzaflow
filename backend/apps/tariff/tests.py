from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.oral.models import ProcedureCatalog
from apps.tariff.models import DentalTariff, DentalTariffItem, TenantTariffItemPrice
from apps.tariff.services.parser import parse_tariff_text
from apps.tariff.services.tenant_prices import save_tenant_clinic_price
from apps.tariff.services.vat import excl_from_incl, incl_from_excl, sync_vat_pair
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions
from apps.oral.services.tariff_procedure_sync import sync_tdb_procedures_for_tenant

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

    def test_parse_normalizes_page_header_in_section_name(self):
        messy = """
 2026 YILI
                      DİŞHEKİMLERİNİN UYGULAYACAKLARI AĞIZ DİŞ SAĞLIĞI MUAYENE VE TEDAVİ ÜCRET TARİFESİ
                                           (Bu tarife bütün il ve ilçeler için geçerlidir.)


  3                                               PEDODONTİ                               KDV Hariç   KDV Dahil %10
 3-1   Çocuk Dişhekimi Muayenesi                                                            1.500,00      1.650,00
"""
        items = parse_tariff_text(messy)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0].section_name, "PEDODONTİ")


class VatSyncTests(TestCase):
    def test_incl_from_excl_10_percent(self):
        self.assertEqual(incl_from_excl(Decimal("1000.00"), Decimal("10")), Decimal("1100.00"))

    def test_excl_from_incl_10_percent(self):
        self.assertEqual(excl_from_incl(Decimal("1100.00"), Decimal("10")), Decimal("1000.00"))

    def test_sync_vat_pair_from_incl(self):
        excl, incl = sync_vat_pair(
            changed="incl",
            excl=Decimal("0"),
            incl=Decimal("3375.00"),
            rate_percent=Decimal("10"),
        )
        self.assertEqual(incl, Decimal("3375.00"))
        self.assertEqual(excl, Decimal("3068.18"))


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

    def test_tenant_tariff_list_reads_base_without_override_row(self):
        self.assertFalse(
            TenantTariffItemPrice.objects.filter(tenant=self.tenant, tariff_item=self.item).exists()
        )
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/tariff/items/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["count"], 1)
        row = body["results"][0]
        self.assertEqual(row["code"], "2-4")
        self.assertEqual(Decimal(str(row["reference_incl"])), Decimal("3375.00"))
        self.assertEqual(Decimal(str(row["clinic_incl"])), Decimal("3375.00"))

    def test_clinic_price_patch_rejects_below_floor(self):
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/tariff/items/{self.item.pk}/clinic-price/",
            {"clinic_price_incl_vat": "1000.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)
        self.assertIn("clinic_price_incl_vat", r.json())
        self.assertIsInstance(r.json()["clinic_price_incl_vat"], list)

    def test_clinic_price_patch_accepts_above_floor(self):
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/tariff/items/{self.item.pk}/clinic-price/",
            {"clinic_price_incl_vat": "4400.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(Decimal(str(r.json()["clinic_incl"])), Decimal("4400.00"))
        row = TenantTariffItemPrice.objects.get(tenant=self.tenant, tariff_item=self.item)
        self.assertEqual(row.clinic_price_incl_vat, Decimal("4400.00"))

    def test_clinic_price_patch_to_base_deletes_override(self):
        save_tenant_clinic_price(self.tenant.pk, self.item, Decimal("4400.00"))
        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/tariff/items/{self.item.pk}/clinic-price/",
            {"clinic_price_incl_vat": "3375.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertFalse(
            TenantTariffItemPrice.objects.filter(tenant=self.tenant, tariff_item=self.item).exists()
        )

    def test_sync_tdb_procedures(self):
        stats = sync_tdb_procedures_for_tenant(self.tenant.pk)
        self.assertEqual(stats["synced"], 1)
        proc = ProcedureCatalog.objects.get(tenant=self.tenant, code="2-4")
        self.assertTrue(proc.is_tdb)
        self.assertEqual(proc.default_price, Decimal("3375.00"))

    def test_year_bump_flags_below_floor_custom_price(self):
        save_tenant_clinic_price(self.tenant.pk, self.item, Decimal("3600.00"))

        # 2027 tariff raises the floor above the dentist's custom price.
        tariff_2027 = DentalTariff.objects.create(year=2027, title="2027", is_active=True)
        item_2027 = DentalTariffItem.objects.create(
            tariff=tariff_2027,
            section_no=2,
            section_name="TEDAVİ VE ENDODONTİ",
            code="2-4",
            name="Kompozit Dolgu (Bir Yüzlü)",
            price_incl_vat=Decimal("4400.00"),
        )
        DentalTariff.objects.exclude(pk=tariff_2027.pk).update(is_active=False)

        from apps.tariff.services.tenant_year_sync import sync_active_tariff_to_all_tenants

        stats = sync_active_tariff_to_all_tenants(tariff=tariff_2027)
        self.assertGreaterEqual(stats["bumped"], 1)

        new_row = TenantTariffItemPrice.objects.get(tenant=self.tenant, tariff_item=item_2027)
        self.assertTrue(new_row.floor_bumped)
        self.assertEqual(new_row.clinic_price_incl_vat, Decimal("4400.00"))

        token = self._login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/tariff/items/")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["bumped_count"], 1)
        rowj = body["results"][0]
        self.assertTrue(rowj["floor_bumped"])

        # Dentist edits price -> flag clears.
        r2 = self.client.patch(
            f"/api/v1/tariff/items/{item_2027.pk}/clinic-price/",
            {"clinic_price_incl_vat": "5000.00"},
            format="json",
        )
        self.assertEqual(r2.status_code, 200, r2.content)
        self.assertFalse(r2.json()["floor_bumped"])
        new_row.refresh_from_db()
        self.assertFalse(new_row.floor_bumped)

    def test_year_carryover_preserves_markup_above_new_floor(self):
        save_tenant_clinic_price(self.tenant.pk, self.item, Decimal("10000.00"))

        tariff_2027 = DentalTariff.objects.create(year=2027, title="2027", is_active=True)
        item_2027 = DentalTariffItem.objects.create(
            tariff=tariff_2027,
            section_no=2,
            section_name="TEDAVİ VE ENDODONTİ",
            code="2-4",
            name="Kompozit Dolgu (Bir Yüzlü)",
            price_incl_vat=Decimal("4400.00"),
        )
        DentalTariff.objects.exclude(pk=tariff_2027.pk).update(is_active=False)

        from apps.tariff.services.tenant_year_sync import sync_active_tariff_to_all_tenants

        sync_active_tariff_to_all_tenants(tariff=tariff_2027)
        new_row = TenantTariffItemPrice.objects.get(tenant=self.tenant, tariff_item=item_2027)
        self.assertFalse(new_row.floor_bumped)
        self.assertEqual(new_row.clinic_price_incl_vat, Decimal("10000.00"))

    def test_activate_tariff_does_not_create_base_override_rows(self):
        from apps.tariff.services.tenant_year_sync import sync_active_tariff_to_all_tenants

        self.assertEqual(TenantTariffItemPrice.objects.filter(tenant=self.tenant).count(), 0)
        stats = sync_active_tariff_to_all_tenants(tariff=self.tariff)
        self.assertEqual(stats["created"], 0)
        self.assertEqual(TenantTariffItemPrice.objects.filter(tenant=self.tenant).count(), 0)

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
