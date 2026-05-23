from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

User = get_user_model()

_MOCK_IDENTITY = {
    "verified": True,
    "reference": "mock-ref",
    "normalized_first_name": "AYŞE",
    "normalized_last_name": "YILMAZ",
}


class CustomerPatientApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(
            customer_code="CLINIC",
            name="Clinic",
            max_users=5,
        )
        set_module_subscriptions(cls.tenant, ["patients"], extra_modules=set())

        cls.dept = Department.objects.create(tenant=cls.tenant, key="doc", name="Doctor")
        perms = Permission.objects.filter(
            codename__in=("patients.read", "patients.write", "customers.read", "customers.write")
        )
        cls.dept.permissions.set(perms)

        cls.user = User.all_tenants.create(
            tenant=cls.tenant,
            email="doc@clinic.test",
            department=cls.dept,
            is_active=True,
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "CLINIC",
                "email": "doc@clinic.test",
                "password": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    @patch("apps.customers.serializers.verify_identity", return_value=_MOCK_IDENTITY)
    def test_patients_api_creates_patient_kind(self, _mock_identity):
        r = self.client.post(
            "/api/v1/patients/",
            {
                "nationality": "tc",
                "first_name": "Ayşe",
                "last_name": "Yılmaz",
                "tckn": "11111111110",
                "birth_date": "1990-01-01",
                "mobile_phone": "5321234567",
                "email": "ayse@test.com",
                "home_address": SAMPLE_HOME_ADDRESS,
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        obj = Customer.all_tenants.get(pk=r.json()["id"])
        self.assertEqual(obj.kind, Customer.Kind.PATIENT)

    def test_customers_api_forbidden_without_module(self):
        r = self.client.get("/api/v1/customers/")
        self.assertEqual(r.status_code, 403)

    def test_login_includes_module_parents(self):
        set_module_subscriptions(
            self.tenant,
            ["customers", "patients"],
            module_parents={"patients": "customers"},
        )
        r = self.client.post(
            "/api/v1/auth/login/",
            {
                "customer_code": "CLINIC",
                "email": "doc@clinic.test",
                "password": "StaffPass1!X",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["module_parents"], {"patients": "customers"})

    def test_list_provinces_from_database(self):
        from unittest.mock import patch

        from apps.customers.models import TurkishProvince
        from apps.customers.nvi_views import list_provinces

        self.assertGreaterEqual(TurkishProvince.objects.count(), 81)
        with patch("apps.customers.nvi_views._get_handler") as mock_handler:
            rows = list_provinces()
            mock_handler.assert_not_called()
        self.assertGreaterEqual(len(rows), 81)
        istanbul = next(row for row in rows if row["code"] == 34)
        self.assertEqual(istanbul["name"], "İSTANBUL")
