from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.barcode.models import BarcodeSettings, LabelTemplate, PrintJob, PrintJobStatus
from apps.barcode.services.lookup import lookup_barcode
from apps.barcode.services.settings import get_or_create_settings
from apps.products.models import Category, Product
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class BarcodeSettingsTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            customer_code="TSET",
            name="Settings Test",
            enabled_modules=["products", "inventory", "barcode"],
            max_users=5,
        )
        set_module_subscriptions(
            self.tenant,
            ["products", "inventory", "barcode"],
            module_parents={"barcode": "inventory"},
        )
        for codename in ["barcode.scan", "barcode.print", "barcode.labels", "barcode.generate"]:
            Permission.objects.get_or_create(codename=codename, defaults={"name": codename})

        dept = Department.objects.create(tenant=self.tenant, key="admin", name="Admin")
        dept.permissions.set(Permission.objects.filter(codename__startswith="barcode."))

        self.user = User.all_tenants.create(
            tenant=self.tenant,
            email="admin@set.test",
            department=dept,
            is_active=True,
        )
        self.user.set_password("TestPass123!@#X")
        self.user.save()

        cat = Category.objects.create(tenant=self.tenant, name="Test", slug="test")
        self.product = Product.objects.create(
            tenant=self.tenant,
            category=cat,
            sku="SET-SKU",
            name="Settings Product",
            barcode="8698888888888",
            unit_price=Decimal("50.00"),
            is_active=True,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_settings_created_on_get(self):
        res = self.client.get("/api/v1/barcode/settings/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["scan_miss_action"], "create_wizard")
        self.assertTrue(BarcodeSettings.objects.filter(tenant=self.tenant).exists())

    def test_lookup_miss_returns_action_hint(self):
        res = self.client.get("/api/v1/barcode/lookup/", {"code": "UNKNOWN999"})
        self.assertEqual(res.status_code, 404)
        self.assertEqual(res.data["scan_miss_action"], "create_wizard")

    def test_lookup_no_sku_fallback(self):
        Product.objects.create(
            tenant=self.tenant,
            category=self.product.category,
            sku="SKU-ONLY",
            name="No Barcode",
            barcode="",
            unit_price=Decimal("1"),
            is_active=True,
        )
        self.assertIsNone(lookup_barcode(self.tenant.id, "SKU-ONLY"))

    def test_scan_miss_create_wizard(self):
        res = self.client.post(
            "/api/v1/barcode/scan-miss/create/",
            {"step": 1, "code": "8697777777777", "name": "Wizard Product"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertTrue(
            Product.objects.filter(tenant=self.tenant, barcode="8697777777777").exists()
        )

    def test_effective_settings(self):
        res = self.client.get("/api/v1/barcode/settings/effective/")
        self.assertEqual(res.status_code, 200)
        self.assertIn("printer_profile", res.data)

    def test_template_delete_cancels_jobs(self):
        settings = get_or_create_settings(self.tenant.id)
        settings.scan_miss_action = "ignore"
        settings.save()
        tpl = LabelTemplate.objects.create(
            tenant=self.tenant,
            name="Del Test",
            width_mm=40,
            height_mm=30,
            layout_json=[],
        )
        job = PrintJob.objects.create(
            tenant=self.tenant,
            template=tpl,
            product_ids=[self.product.pk],
            layout_snapshot=[],
            template_snapshot={},
            status=PrintJobStatus.QUEUED,
        )
        res = self.client.delete(f"/api/v1/barcode/templates/{tpl.pk}/")
        self.assertEqual(res.status_code, 200)
        job.refresh_from_db()
        self.assertEqual(job.status, PrintJobStatus.FAILED)
