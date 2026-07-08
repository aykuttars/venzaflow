from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import ALL_MODULES, NON_BILLABLE_MODULES, PERMISSION_CODENAMES
from apps.tenants.models import Tenant

User = get_user_model()


class PlatformAdminTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(
            customer_code="9000",
            name="Existing",
            enabled_modules=["dashboard"],
        )
        cls.dept = Department.objects.create(
            tenant=cls.tenant,
            key="admin",
            name="Admin",
        )
        cls.tenant_user = User.all_tenants.create(
            tenant=cls.tenant,
            email="user@tenant.com",
            department=cls.dept,
            is_active=True,
        )
        cls.tenant_user.set_password("TenantPass1!X")
        cls.tenant_user.save()

        cls.platform_user = User.all_tenants.create(
            tenant=None,
            email="admin@platform.local",
            is_superuser=True,
            is_staff=True,
            is_active=True,
        )
        cls.platform_user.set_password("PlatformPass1!X")
        cls.platform_user.save()

    def setUp(self):
        self.client = APIClient()

    def _platform_login(self):
        r = self.client.post(
            "/api/v1/platform/auth/login/",
            {"email": "admin@platform.local", "password": "PlatformPass1!X"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        data = r.json()
        self.assertTrue(data.get("is_platform"))
        self.assertIn("products.read", data["permissions"])
        return data["access"], data["refresh"]

    def test_platform_login_succeeds(self):
        access, _ = self._platform_login()
        self.assertTrue(access)

    def test_platform_user_cannot_tenant_login(self):
        r = self.client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "9000",
                "email": "admin@platform.local",
                "password": "PlatformPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_tenant_user_cannot_platform_login(self):
        r = self.client.post(
            "/api/v1/platform/auth/login/",
            {"email": "user@tenant.com", "password": "TenantPass1!X"},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_create_tenant_with_initial_admin(self):
        access, _ = self._platform_login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        r = self.client.post(
            "/api/v1/platform/tenants/",
            {
                "customer_code": "8001",
                "name": "New Clinic",
                "default_language": "tr",
                "is_active": True,
                "subscribed_modules": ["products"],
                "module_labels": {"customers": "Hastalar"},
                "initial_admin_email": "owner@8001.com",
                "initial_admin_password": "OwnerPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        tenant = Tenant.objects.get(customer_code="8001")
        self.assertIn("products", tenant.enabled_modules)
        self.assertIn("dashboard", tenant.enabled_modules)
        self.assertEqual(tenant.module_labels.get("customers"), "Hastalar")
        admin = User.all_tenants.get(tenant=tenant, email="owner@8001.com")
        self.assertEqual(admin.department.key, "admin")

        login_r = self.client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "8001",
                "email": "owner@8001.com",
                "password": "OwnerPass1!X",
            },
            format="json",
        )
        self.assertEqual(login_r.status_code, 200, login_r.content)

    def test_patch_tenant_enabled_modules(self):
        access, _ = self._platform_login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        r = self.client.patch(
            f"/api/v1/platform/tenants/{self.tenant.pk}/",
            {"subscribed_modules": [m for m in ALL_MODULES if m not in NON_BILLABLE_MODULES]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.tenant.refresh_from_db()
        self.assertEqual(len(self.tenant.enabled_modules), len(ALL_MODULES))

    def test_platform_user_cannot_list_tenant_products(self):
        access, _ = self._platform_login()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        r = self.client.get("/api/v1/products/")
        self.assertEqual(r.status_code, 403)
