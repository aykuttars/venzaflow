from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department
from apps.products.models import Category, Product
from apps.tenants.models import Tenant

User = get_user_model()


class TenantIsolationTests(TestCase):
    """End-to-end cross-tenant isolation across the product endpoint."""

    @classmethod
    def setUpTestData(cls):
        cls.t1 = Tenant.objects.create(customer_code="T1", name="One", enabled_modules=["products"])
        cls.t2 = Tenant.objects.create(customer_code="T2", name="Two", enabled_modules=["products"])

        cls.d1 = Department.objects.create(tenant=cls.t1, key="admin", name="Admin")
        cls.d2 = Department.objects.create(tenant=cls.t2, key="admin", name="Admin")

        from apps.accounts.models import Permission

        for code in ("products.read", "products.write"):
            p, _ = Permission.objects.get_or_create(codename=code, defaults={"name": code})
            cls.d1.permissions.add(p)
            cls.d2.permissions.add(p)

        cls.u1 = User.all_tenants.create(
            tenant=cls.t1, email="a@x.com", department=cls.d1, is_active=True
        )
        cls.u1.set_password("pw123456")
        cls.u1.save()
        cls.u2 = User.all_tenants.create(
            tenant=cls.t2, email="b@x.com", department=cls.d2, is_active=True
        )
        cls.u2.set_password("pw123456")
        cls.u2.save()

        cls.c1 = Category.objects.create(tenant=cls.t1, name="C1", slug="c1")
        cls.c2 = Category.objects.create(tenant=cls.t2, name="C2", slug="c2")
        Product.objects.create(tenant=cls.t1, sku="A1", name="A", category=cls.c1, unit_price=1)
        Product.objects.create(tenant=cls.t2, sku="B1", name="B", category=cls.c2, unit_price=2)

    def _login(self, code, email, password):
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": code, "email": email, "password": password},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["access"]

    def setUp(self):
        self.client = APIClient()

    def test_login_returns_jwt_with_tenant_claim(self):
        token = self._login("T1", "a@x.com", "pw123456")
        self.assertTrue(token)

    def test_listing_products_returns_only_own_tenant_rows(self):
        token = self._login("T1", "a@x.com", "pw123456")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/products/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        results = data.get("results", data)
        skus = [p["sku"] for p in results]
        self.assertEqual(skus, ["A1"])

    def test_cannot_retrieve_other_tenant_row(self):
        token = self._login("T1", "a@x.com", "pw123456")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        other = Product.all_tenants.filter(tenant=self.t2).first()
        r = self.client.get(f"/api/v1/products/{other.pk}/")
        self.assertEqual(r.status_code, 404)

    def test_cannot_delete_other_tenant_row(self):
        token = self._login("T1", "a@x.com", "pw123456")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        other = Product.all_tenants.filter(tenant=self.t2).first()
        r = self.client.delete(f"/api/v1/products/{other.pk}/")
        self.assertEqual(r.status_code, 404)
        self.assertTrue(Product.all_tenants.filter(pk=other.pk).exists())

    def test_create_stamps_current_tenant(self):
        token = self._login("T2", "b@x.com", "pw123456")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/products/",
            {"sku": "NEW", "name": "N", "category": self.c2.pk, "unit_price": "3.00"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        new = Product.all_tenants.get(sku="NEW")
        self.assertEqual(new.tenant_id, self.t2.pk)

    def test_module_disabled_blocks_access(self):
        self.t1.enabled_modules = []
        self.t1.save()
        token = self._login("T1", "a@x.com", "pw123456")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/products/")
        self.assertEqual(r.status_code, 403)

    def test_forged_tenant_id_payload_ignored(self):
        token = self._login("T1", "a@x.com", "pw123456")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/products/",
            {
                "sku": "FORGE",
                "name": "F",
                "category": self.c1.pk,
                "unit_price": "1.00",
                "tenant": self.t2.pk,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        new = Product.all_tenants.get(sku="FORGE")
        self.assertEqual(new.tenant_id, self.t1.pk)
