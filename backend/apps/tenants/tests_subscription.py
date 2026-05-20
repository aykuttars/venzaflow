from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.products.models import Category, Product
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class TenantSubscriptionTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(
            customer_code="SUB1",
            name="Sub Test",
            max_users=5,
            enabled_modules=["products"],
        )
        set_module_subscriptions(cls.tenant, ["products"], extra_modules=set())

        cls.dept = Department.objects.create(
            tenant=cls.tenant,
            key="staff",
            name="Staff",
        )
        p_read, _ = Permission.objects.get_or_create(
            codename="products.read",
            defaults={"name": "products.read"},
        )
        p_write, _ = Permission.objects.get_or_create(
            codename="products.write",
            defaults={"name": "products.write"},
        )
        perms = [p_read, p_write]
        for code in ("employees.read", "employees.write"):
            p, _ = Permission.objects.get_or_create(codename=code, defaults={"name": code})
            perms.append(p)
        cls.dept.permissions.set(perms)

        cls.platform = User.all_tenants.create(
            tenant=None,
            email="platform@test.com",
            is_superuser=True,
            is_staff=True,
            is_active=True,
        )
        cls.platform.set_password("PlatformPass1!X")
        cls.platform.save()

        cls.cat = Category.objects.create(tenant=cls.tenant, name="C", slug="c")
        Product.objects.create(
            tenant=cls.tenant,
            sku="P1",
            name="P",
            category=cls.cat,
            unit_price=1,
        )

    def setUp(self):
        self.client = APIClient()

    def _create_staff(self, n: int, start: int = 0):
        for i in range(start, start + n):
            u = User.all_tenants.create(
                tenant=self.tenant,
                email=f"user{start + i}@sub.test",
                department=self.dept,
                is_active=True,
            )
            u.set_password("StaffPass1!X")
            u.save()

    def _login_staff(self, email: str = "user0@sub.test"):
        r = self.client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "SUB1",
                "email": email,
                "password": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["access"]

    def _platform_login(self):
        r = self.client.post(
            "/api/v1/platform/auth/login/",
            {"email": "platform@test.com", "password": "PlatformPass1!X"},
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        return r.json()["access"]

    def test_user_limit_blocks_sixth_user(self):
        self._create_staff(5)
        token = self._login_staff("user0@sub.test")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/employees/",
            {
                "email": "sixth@sub.test",
                "first_name": "Six",
                "last_name": "Th",
                "department": self.dept.pk,
                "password": "StaffPass1!X",
                "password_confirm": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_increase_max_users_allows_create(self):
        self._create_staff(5)
        platform_token = self._platform_login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {platform_token}")
        self.client.patch(
            f"/api/v1/platform/tenants/{self.tenant.pk}/",
            {"max_users": 6},
            format="json",
        )
        token = self._login_staff("user0@sub.test")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/employees/",
            {
                "email": "sixth@sub.test",
                "first_name": "Six",
                "last_name": "Th",
                "department": self.dept.pk,
                "password": "StaffPass1!X",
                "password_confirm": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)

    def test_module_subscription_required_for_api(self):
        set_module_subscriptions(self.tenant, [], extra_modules=set())
        token = self._login_staff()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/products/")
        self.assertEqual(r.status_code, 403)

    def test_login_includes_subscription_payload(self):
        self._create_staff(2)
        r = self.client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "SUB1",
                "email": "user0@sub.test",
                "password": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        sub = r.json()["subscription"]
        self.assertEqual(sub["max_users"], 5)
        self.assertEqual(sub["active_users"], 2)
