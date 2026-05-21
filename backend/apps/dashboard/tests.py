from __future__ import annotations

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.models import Customer
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()


class DashboardSummaryModuleTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(
            customer_code="DASH1",
            name="Dashboard Test",
            enabled_modules=["dashboard", "products"],
        )
        set_module_subscriptions(cls.tenant, ["dashboard", "products"], extra_modules=set())

        cls.dept = Department.objects.create(
            tenant=cls.tenant,
            key="staff",
            name="Staff",
        )
        p_dash, _ = Permission.objects.get_or_create(
            codename="dashboard.read",
            defaults={"name": "dashboard.read"},
        )
        cls.dept.permissions.set([p_dash])

        cls.user = User.all_tenants.create(
            tenant=cls.tenant,
            email="dash@test.com",
            department=cls.dept,
            is_active=True,
        )
        cls.user.set_password("DashPass1!X")
        cls.user.save()

        Customer.objects.create(
            tenant=cls.tenant,
            kind=Customer.Kind.CUSTOMER,
            first_name="Hidden",
            last_name="Customer",
        )

    def setUp(self):
        self.client = APIClient()

    def test_summary_omits_customer_count_without_customers_module(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get("/api/v1/dashboard/summary/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["customer_count"], 0)
        self.assertEqual(response.data["patient_count"], 0)
        self.assertEqual(response.data["daily_sales"], 0)
        self.assertEqual(response.data["open_invoices_count"], 0)
        self.assertEqual(response.data["critical_stock"], [])
        self.assertEqual(response.data["upcoming_appointments"], [])
        self.assertEqual(response.data["recent_payments"], [])
        self.assertEqual(response.data["recent_transactions"], [])
