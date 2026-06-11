from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.inventory.models import Stock, Warehouse
from apps.products.models import Category, Product
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class InventoryApiExtensionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant_a = Tenant.objects.create(customer_code="INV-A", name="Tenant A", max_users=5)
        cls.tenant_b = Tenant.objects.create(customer_code="INV-B", name="Tenant B", max_users=5)
        set_module_subscriptions(cls.tenant_a, ["products", "inventory"], extra_modules=set())
        set_module_subscriptions(cls.tenant_b, ["products", "inventory"], extra_modules=set())

        perms = Permission.objects.filter(
            codename__in=("products.read", "products.write", "inventory.read", "inventory.write")
        )

        cls.dept_a = Department.objects.create(tenant=cls.tenant_a, key="ops", name="Ops")
        cls.dept_a.permissions.set(perms)
        cls.user_a = User.all_tenants.create(
            tenant=cls.tenant_a,
            email="inv-a@test.local",
            department=cls.dept_a,
            is_active=True,
        )
        cls.user_a.set_password("TestPass1!X")
        cls.user_a.save()

        cls.dept_b = Department.objects.create(tenant=cls.tenant_b, key="ops", name="Ops")
        cls.dept_b.permissions.set(perms)
        cls.user_b = User.all_tenants.create(
            tenant=cls.tenant_b,
            email="inv-b@test.local",
            department=cls.dept_b,
            is_active=True,
        )
        cls.user_b.set_password("TestPass1!X")
        cls.user_b.save()

        cat = Category.objects.create(tenant=cls.tenant_a, name="Cat", slug="cat")
        cls.product = Product.objects.create(
            tenant=cls.tenant_a,
            sku="SKU-API",
            name="API Product",
            category=cat,
            unit_price="5.00",
        )
        cls.warehouse = Warehouse.objects.create(tenant=cls.tenant_a, code="WH-API", name="Main")
        cls.stock = Stock.objects.create(
            tenant=cls.tenant_a,
            product=cls.product,
            warehouse=cls.warehouse,
            quantity=20,
        )

    def setUp(self):
        self.stock.quantity = 20
        self.stock.save(update_fields=["quantity"])

    def _login(self, client: APIClient, code: str, email: str) -> None:
        r = client.post(
            "/api/v1/auth/login/",
            {"customer_code": code, "email": email, "password": "TestPass1!X"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    def test_tenant_isolation_stock_list(self):
        client_b = APIClient()
        self._login(client_b, "INV-B", "inv-b@test.local")
        r = client_b.get("/api/v1/inventory/stock/")
        self.assertEqual(r.status_code, 200)
        ids = {row["id"] for row in r.json()["results"]}
        self.assertNotIn(self.stock.id, ids)

    def test_movement_backward_compat_delta(self):
        client = APIClient()
        self._login(client, "INV-A", "inv-a@test.local")
        r = client.post(
            "/api/v1/inventory/movements/",
            {"stock": self.stock.id, "delta": -2},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 18)
        body = r.json()
        self.assertEqual(body["delta"], -2)

    def test_movement_create_with_quantity(self):
        client = APIClient()
        self._login(client, "INV-A", "inv-a@test.local")
        r = client.post(
            "/api/v1/inventory/movements/",
            {
                "stock": self.stock.id,
                "movement_type": "PURCHASE",
                "quantity": 3,
                "note": "restock",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity, 23)

    def test_locations_endpoint(self):
        client = APIClient()
        self._login(client, "INV-A", "inv-a@test.local")
        r = client.post(
            "/api/v1/inventory/locations/",
            {"warehouse": self.warehouse.id, "code": "A1", "name": "Shelf A1"},
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        r2 = client.get("/api/v1/inventory/locations/")
        self.assertEqual(r2.status_code, 200)
        self.assertTrue(any(row["code"] == "A1" for row in r2.json()["results"]))

    def test_movement_cannot_update_or_delete(self):
        client = APIClient()
        self._login(client, "INV-A", "inv-a@test.local")
        create = client.post(
            "/api/v1/inventory/movements/",
            {"stock": self.stock.id, "delta": 1},
            format="json",
        )
        self.assertEqual(create.status_code, 201)
        mv_id = create.json()["id"]
        put = client.put(f"/api/v1/inventory/movements/{mv_id}/", {"note": "x"}, format="json")
        self.assertEqual(put.status_code, 405)
        delete = client.delete(f"/api/v1/inventory/movements/{mv_id}/")
        self.assertEqual(delete.status_code, 405)

    def test_inventory_dashboard(self):
        client = APIClient()
        self._login(client, "INV-A", "inv-a@test.local")
        r = client.get("/api/v1/inventory/dashboard/")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("total_products", data)
        self.assertIn("total_stock", data)
        self.assertIn("critical_stock", data)

    def test_stock_export_csv(self):
        client = APIClient()
        self._login(client, "INV-A", "inv-a@test.local")
        r = client.get("/api/v1/inventory/stock/export/")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"SKU-API", r.content)
