from __future__ import annotations

from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.barcode.models import LabelTemplate
from apps.barcode.services.lookup import lookup_barcode
from apps.barcode.services.seed_templates import seed_default_templates
from apps.products.models import Category, Product
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class BarcodeApiTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(
            customer_code="TBC",
            name="Barcode Test",
            enabled_modules=["products", "inventory", "barcode"],
            max_users=5,
        )
        set_module_subscriptions(
            self.tenant,
            ["products", "inventory", "barcode"],
            module_parents={"barcode": "inventory"},
        )
        seed_default_templates(self.tenant.id)

        for codename in ["barcode.scan", "barcode.print", "barcode.labels", "barcode.generate"]:
            Permission.objects.get_or_create(codename=codename, defaults={"name": codename})

        dept = Department.objects.create(tenant=self.tenant, key="admin", name="Admin")
        dept.permissions.set(Permission.objects.filter(codename__startswith="barcode."))

        self.user = User.all_tenants.create(
            tenant=self.tenant,
            email="admin@bc.test",
            department=dept,
            is_active=True,
        )
        self.user.set_password("TestPass123!@#X")
        self.user.save()

        cat = Category.objects.create(tenant=self.tenant, name="Test", slug="test")
        self.product = Product.objects.create(
            tenant=self.tenant,
            category=cat,
            sku="TEST-SKU",
            name="Test Product",
            barcode="8699999999999",
            unit_price=Decimal("100.00"),
            is_active=True,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_lookup_by_barcode(self):
        result = lookup_barcode(self.tenant.id, "8699999999999")
        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(result["product"]["sku"], "TEST-SKU")

    def test_lookup_api(self):
        res = self.client.get("/api/v1/barcode/lookup/", {"code": "8699999999999"})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["product"]["id"], self.product.id)

    def test_default_templates_seeded(self):
        self.assertGreaterEqual(
            LabelTemplate.objects.filter(tenant_id=self.tenant.id).count(), 5
        )

    def test_template_list(self):
        res = self.client.get("/api/v1/barcode/templates/")
        self.assertEqual(res.status_code, 200)

    def test_create_print_job(self):
        tpl = LabelTemplate.objects.filter(tenant_id=self.tenant.id).first()
        res = self.client.post(
            "/api/v1/barcode/print-jobs/",
            {"template_id": tpl.pk, "product_ids": [self.product.pk], "copies": 1},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["status"], "queued")
