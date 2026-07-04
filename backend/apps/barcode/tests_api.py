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

    def test_template_preview_with_product(self):
        from apps.products.models import FieldType, ProductFieldDefinition, ProductFieldValue

        ProductFieldDefinition.objects.create(
            tenant=self.tenant,
            key="marka",
            label="Marka",
            field_type=FieldType.TEXT.value,
            is_active=True,
        )
        ProductFieldValue.objects.create(
            tenant=self.tenant,
            product=self.product,
            field_definition=ProductFieldDefinition.objects.get(tenant=self.tenant, key="marka"),
            value_text="TestMarka",
        )
        tpl = LabelTemplate.objects.filter(tenant_id=self.tenant.id).first()
        res = self.client.post(
            f"/api/v1/barcode/templates/{tpl.pk}/preview/",
            {"product_id": self.product.pk},
            format="json",
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "image/png")
        self.assertGreater(len(res.content), 100)

    def test_binding_fields_api(self):
        from apps.products.models import FieldType, ProductFieldDefinition

        ProductFieldDefinition.objects.create(
            tenant=self.tenant,
            key="marka",
            label="Marka",
            field_type=FieldType.TEXT.value,
            is_active=True,
        )
        res = self.client.get("/api/v1/barcode/templates/binding-fields/")
        self.assertEqual(res.status_code, 200)
        bindings = {row["binding"] for row in res.data}
        self.assertIn("product.price", bindings)
        self.assertIn("product.field.marka", bindings)
        self.assertIn("label.print_date", bindings)

    def test_template_preview_barcode_show_text(self):
        from apps.barcode.services.preview import render_label_png
        from apps.barcode.services.settings import get_or_create_settings

        tpl = LabelTemplate.objects.filter(tenant_id=self.tenant.id).first()
        layout = [
            {
                "id": "bc",
                "type": "barcode_1d",
                "x": 2,
                "y": 2,
                "width": 40,
                "height": 16,
                "rotation": 0,
                "symbology": "EAN13",
                "data_binding": "product.barcode",
                "show_text": True,
            }
        ]
        png = render_label_png(
            width_mm=tpl.width_mm,
            height_mm=tpl.height_mm,
            dpi=tpl.dpi,
            layout_json=layout,
            tenant_id=self.tenant.id,
            product_id=self.product.pk,
            settings=get_or_create_settings(self.tenant.id),
        )
        self.assertGreater(len(png), 100)
