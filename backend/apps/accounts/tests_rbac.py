from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class TenantRbacTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(customer_code="RBAC", name="RBAC Clinic", max_users=20)
        set_module_subscriptions(
            cls.tenant,
            [
                "dashboard",
                "settings",
                "employees",
                "billing",
                "patients",
            ],
        )

        cls.admin_dept = Department.objects.create(tenant=cls.tenant, key="admin", name="Admin")
        cls.cashier_dept = Department.objects.create(tenant=cls.tenant, key="cashier", name="Cashier")

        admin_perms = Permission.objects.filter(
            codename__in=[
                "dashboard.read",
                "settings.read",
                "settings.write",
                "employees.read",
                "employees.write",
                "billing.read",
                "billing.write",
                "patients.read",
            ]
        )
        cashier_perms = Permission.objects.filter(
            codename__in=["dashboard.read", "billing.read", "billing.write", "patients.read"]
        )
        cls.admin_dept.permissions.set(admin_perms)
        cls.cashier_dept.permissions.set(cashier_perms)

        cls.admin = User.all_tenants.create(
            tenant=cls.tenant,
            email="admin@rbac.test",
            department=cls.admin_dept,
            is_active=True,
        )
        cls.admin.set_password("AdminPass1!X")
        cls.admin.save()

        cls.cashier = User.all_tenants.create(
            tenant=cls.tenant,
            email="cash@rbac.test",
            department=cls.cashier_dept,
            is_active=True,
        )
        cls.cashier.set_password("CashPass1!X")
        cls.cashier.save()

        cls.hr = User.all_tenants.create(
            tenant=cls.tenant,
            email="hr@rbac.test",
            department=cls.cashier_dept,
            is_active=True,
        )
        cls.hr.set_password("HrPass1!X")
        cls.hr.save()
        hr_extra = Permission.objects.filter(
            codename__in=["employees.read", "employees.write"]
        )
        cls.hr.extra_permissions.set(hr_extra)

        cls.cashier2 = User.all_tenants.create(
            tenant=cls.tenant,
            email="cash2@rbac.test",
            department=cls.cashier_dept,
            is_active=True,
        )
        cls.cashier2.set_password("CashPass1!X")
        cls.cashier2.save()

    def setUp(self):
        self.client = APIClient()

    def _login(self, email: str, password: str) -> str:
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "RBAC", "email": email, "password": password},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()["access"]

    def test_hr_cannot_patch_admin(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/employees/{self.admin.pk}/",
            {"first_name": "Hacked"},
            format="json",
        )
        self.assertEqual(r.status_code, 403, r.content)

    def test_hr_cannot_delete_admin(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.delete(f"/api/v1/employees/{self.admin.pk}/")
        self.assertEqual(r.status_code, 403, r.content)

    def test_hr_cannot_patch_peer_cashier(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/employees/{self.cashier2.pk}/",
            {"first_name": "Peer"},
            format="json",
        )
        self.assertEqual(r.status_code, 403, r.content)

    def test_admin_can_patch_cashier(self):
        token = self._login("admin@rbac.test", "AdminPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/employees/{self.cashier.pk}/",
            {"first_name": "Updated"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

    def test_hr_self_name_change_allowed(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/employees/{self.hr.pk}/",
            {"first_name": "HumanResources"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

    def test_hr_self_escalation_to_admin_department_blocked(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/employees/{self.hr.pk}/",
            {"department": self.admin_dept.pk},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_hr_cannot_create_user_in_admin_department(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.post(
            "/api/v1/employees/",
            {
                "email": "newadmin@rbac.test",
                "department": self.admin_dept.pk,
                "password": "NewUserPass1!X",
                "password_confirm": "NewUserPass1!X",
            },
            format="json",
        )
        self.assertIn(r.status_code, (400, 403), r.content)

    def test_hr_cannot_grant_settings_write(self):
        low_dept = Department.objects.create(tenant=self.tenant, key="trainee", name="Trainee")
        low_dept.permissions.set(
            Permission.objects.filter(codename__in=["dashboard.read", "patients.read"])
        )
        trainee = User.all_tenants.create(
            tenant=self.tenant,
            email="trainee@rbac.test",
            department=low_dept,
            is_active=True,
        )
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.patch(
            f"/api/v1/employees/{trainee.pk}/",
            {"extra_permission_codenames": ["settings.write"]},
            format="json",
        )
        self.assertEqual(r.status_code, 400, r.content)

    def test_manageable_flag_on_employee_list(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/employees/")
        self.assertEqual(r.status_code, 200, r.content)
        rows = {row["email"]: row for row in r.json()["results"]}
        self.assertTrue(rows["hr@rbac.test"]["manageable"])
        self.assertFalse(rows["admin@rbac.test"]["manageable"])
        self.assertFalse(rows["cash@rbac.test"]["manageable"])

    def test_permission_list_excludes_unheld_for_hr(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.get("/api/v1/permissions/")
        self.assertEqual(r.status_code, 200, r.content)
        codenames = {row["codename"] for row in r.json()}
        self.assertIn("employees.write", codenames)
        self.assertNotIn("settings.write", codenames)

    def test_hr_cannot_delete_admin_department(self):
        token = self._login("hr@rbac.test", "HrPass1!X")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        r = self.client.delete(f"/api/v1/departments/{self.admin_dept.pk}/")
        self.assertIn(r.status_code, (403, 404), r.content)
