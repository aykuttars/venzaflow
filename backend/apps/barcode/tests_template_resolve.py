from __future__ import annotations

from decimal import Decimal

from django.test import TestCase

from apps.barcode.models import BarcodeSettings, LabelTemplate
from apps.barcode.services.template_resolve import resolve_label_template
from apps.inventory.models import Location, Warehouse
from apps.products.models import Category, Product
from apps.tenants.models import Tenant


class TemplateResolveTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(customer_code="4500", name="T4500", enabled_modules=["barcode"])
        self.other = Tenant.objects.create(customer_code="9999", name="Other", enabled_modules=["barcode"])
        self.cat = Category.objects.create(tenant=self.tenant, name="Cat", slug="cat")
        self.product = Product.objects.create(
            tenant=self.tenant,
            sku="SKU-1",
            name="Product 1",
            category=self.cat,
            unit_price=Decimal("10.00"),
            barcode="8691111111111",
        )
        self.wh = Warehouse.objects.create(tenant=self.tenant, code="DEPO", name="Depo")
        self.loc = Location.objects.create(
            tenant=self.tenant, warehouse=self.wh, code="A1", name="Raf A1"
        )
        self.tpl_product = LabelTemplate.objects.create(
            tenant=self.tenant, name="Product tpl", width_mm=40, height_mm=30
        )
        self.tpl_location = LabelTemplate.objects.create(
            tenant=self.tenant, name="Location tpl", width_mm=50, height_mm=25
        )
        self.tpl_warehouse = LabelTemplate.objects.create(
            tenant=self.tenant, name="Warehouse tpl", width_mm=60, height_mm=40
        )
        self.tpl_default = LabelTemplate.objects.create(
            tenant=self.tenant, name="Tenant default", width_mm=40, height_mm=20
        )
        BarcodeSettings.objects.create(
            tenant=self.tenant,
            default_label_template=self.tpl_default,
        )

    def test_product_wins_over_location_and_warehouse(self):
        self.product.label_template = self.tpl_product
        self.product.save(update_fields=["label_template"])
        self.loc.label_template = self.tpl_location
        self.loc.save(update_fields=["label_template"])
        self.wh.label_template = self.tpl_warehouse
        self.wh.save(update_fields=["label_template"])

        tpl, source = resolve_label_template(
            self.tenant.id,
            product_id=self.product.id,
            warehouse_id=self.wh.id,
            location_id=self.loc.id,
        )
        self.assertEqual(tpl.id, self.tpl_product.id)
        self.assertEqual(source, "product")

    def test_location_wins_when_no_product_template(self):
        self.loc.label_template = self.tpl_location
        self.loc.save(update_fields=["label_template"])
        self.wh.label_template = self.tpl_warehouse
        self.wh.save(update_fields=["label_template"])

        tpl, source = resolve_label_template(
            self.tenant.id,
            product_id=self.product.id,
            warehouse_id=self.wh.id,
            location_id=self.loc.id,
        )
        self.assertEqual(tpl.id, self.tpl_location.id)
        self.assertEqual(source, "location")

    def test_warehouse_when_no_product_or_location(self):
        self.wh.label_template = self.tpl_warehouse
        self.wh.save(update_fields=["label_template"])

        tpl, source = resolve_label_template(
            self.tenant.id,
            product_id=self.product.id,
            warehouse_id=self.wh.id,
        )
        self.assertEqual(tpl.id, self.tpl_warehouse.id)
        self.assertEqual(source, "warehouse")

    def test_tenant_default_fallback(self):
        tpl, source = resolve_label_template(self.tenant.id, product_id=self.product.id)
        self.assertEqual(tpl.id, self.tpl_default.id)
        self.assertEqual(source, "tenant_default")

    def test_first_template_when_no_defaults(self):
        BarcodeSettings.objects.filter(tenant=self.tenant).update(default_label_template=None)
        tpl, source = resolve_label_template(self.tenant.id, product_id=self.product.id)
        self.assertIsNotNone(tpl)
        self.assertEqual(source, "fallback")
