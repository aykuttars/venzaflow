from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class TenantScopedPermissionListTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(customer_code="CLINIC", name="Clinic", max_users=5)
        set_module_subscriptions(
            cls.tenant,
            [m for m in __import__("apps.common.permission_codes", fromlist=["ALL_MODULES"]).ALL_MODULES if m != "customers"],
        )

        cls.dept = Department.objects.create(tenant=cls.tenant, key="admin", name="Admin")
        p_write, _ = Permission.objects.get_or_create(
            codename="employees.write",
            defaults={"name": "employees.write"},
        )
        cls.dept.permissions.set([p_write])

        cls.user = User.all_tenants.create(
            tenant=cls.tenant,
            email="admin@clinic.test",
            department=cls.dept,
            is_active=True,
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

    def test_permission_list_excludes_unsubscribed_modules(self):
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "CLINIC",
                "email": "admin@clinic.test",
                "password": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(login.status_code, 200, login.content)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")

        r = client.get("/api/v1/permissions/")
        self.assertEqual(r.status_code, 200, r.content)
        codenames = {row["codename"] for row in r.json()}
        self.assertIn("patients.read", codenames)
        self.assertNotIn("customers.read", codenames)
