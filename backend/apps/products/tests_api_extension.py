from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.products.models import (
    Category,
    Product,
    ProductFieldDefinition,
    ProductListColumnConfig,
)
from apps.products.ui_defaults import seed_ui_config_for_tenant
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class ProductsApiExtensionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant_a = Tenant.objects.create(customer_code="PRD-A", name="Products A", max_users=5)
        cls.tenant_b = Tenant.objects.create(customer_code="PRD-B", name="Products B", max_users=5)
        set_module_subscriptions(cls.tenant_a, ["products", "inventory"], extra_modules=set())
        set_module_subscriptions(cls.tenant_b, ["products"], extra_modules=set())

        perms = Permission.objects.filter(
            codename__in=("products.read", "products.write", "inventory.read", "inventory.write")
        )
        cls.dept = Department.objects.create(tenant=cls.tenant_a, key="admin", name="Admin")
        cls.dept.permissions.set(perms)
        cls.user = User.all_tenants.create(
            tenant=cls.tenant_a,
            email="prd-a@test.local",
            department=cls.dept,
            is_active=True,
        )
        cls.user.set_password("TestPass1!X")
        cls.user.save()

        cls.cat = Category.objects.create(tenant=cls.tenant_a, name="Genel", slug="genel")
        cls.product = Product.objects.create(
            tenant=cls.tenant_a,
            sku="BASE-SKU",
            name="Base Product",
            category=cls.cat,
            unit_price="100.00",
        )
        ProductFieldDefinition.objects.create(
            tenant=cls.tenant_a,
            key="renk",
            label="Renk",
            field_type="TEXT",
        )
        seed_ui_config_for_tenant(cls.tenant_a.id)

    def _client(self) -> APIClient:
        client = APIClient()
        r = client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "PRD-A",
                "email": "prd-a@test.local",
                "password": "TestPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")
        return client

    def test_list_include_fields(self):
        client = self._client()
        r = client.get("/api/v1/products/", {"include": "fields"})
        self.assertEqual(r.status_code, 200)
        row = next(x for x in r.json()["results"] if x["sku"] == "BASE-SKU")
        self.assertIn("dynamic_fields", row)

    def test_create_with_custom_fields(self):
        client = self._client()
        r = client.post(
            "/api/v1/products/",
            {
                "sku": "CF-001",
                "name": "Custom Field Product",
                "category": self.cat.id,
                "unit_price": "50.00",
                "custom_fields": {"renk": "Siyah"},
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertEqual(body["dynamic_fields"].get("renk"), "Siyah")

    def test_tenant_isolation_products(self):
        other_cat = Category.objects.create(tenant=self.tenant_b, name="B", slug="b")
        Product.objects.create(
            tenant=self.tenant_b,
            sku="OTHER",
            name="Other",
            category=other_cat,
            unit_price="1.00",
        )
        client = self._client()
        r = client.get("/api/v1/products/")
        skus = {row["sku"] for row in r.json()["results"]}
        self.assertIn("BASE-SKU", skus)
        self.assertNotIn("OTHER", skus)

    def test_list_config_seeded(self):
        client = self._client()
        r = client.get("/api/v1/products/list-config/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(len(r.json()["results"]) >= 1)
        self.assertTrue(
            ProductListColumnConfig.objects.filter(tenant=self.tenant_a).exists()
        )

    def test_export_csv(self):
        client = self._client()
        r = client.get("/api/v1/products/export/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn(b"BASE-SKU", r.content)
