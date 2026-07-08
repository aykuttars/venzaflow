from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.oral.models import OralTreatment, PatientOralChart, ProcedureCatalog
from apps.oral.validators import validate_fdi_tooth_numbers
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

from django.contrib.auth import get_user_model

User = get_user_model()


class FdiValidatorTests(SimpleTestCase):
    def test_valid_permanent_teeth(self):
        self.assertEqual(validate_fdi_tooth_numbers([46, 11]), [11, 46])

    def test_rejects_invalid_tooth(self):
        from django.core.exceptions import ValidationError

        with self.assertRaises(ValidationError):
            validate_fdi_tooth_numbers([99])


class OralApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(customer_code="ORAL1", name="Oral Clinic", max_users=5)
        cls.other = Tenant.objects.create(customer_code="ORAL2", name="Other", max_users=5)
        set_module_subscriptions(cls.tenant, ["patients", "oral"], module_parents={"oral": "patients"})
        set_module_subscriptions(cls.other, ["patients", "oral"])
        cls.dept = Department.objects.create(tenant=cls.tenant, key="doc", name="Doctor")
        cls.dept.permissions.set(
            Permission.objects.filter(codename__in=("oral.read", "oral.write", "patients.read"))
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="oral@clinic.test", department=cls.dept, is_active=True
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

        cls.patient = Customer.all_tenants.create(
            tenant=cls.tenant,
            kind=Customer.Kind.PATIENT,
            first_name="Ayşe",
            last_name="Demir",
            mobile_phone="5321112233",
            email="ayse@test.com",
            home_address=SAMPLE_HOME_ADDRESS,
            tckn="11111111110",
            nationality=Customer.Nationality.TC,
        )
        cls.procedure = ProcedureCatalog.all_tenants.create(
            tenant=cls.tenant,
            code="FILL",
            name="Dolgu",
            category=ProcedureCatalog.Category.TREATMENT,
            default_price=Decimal("850.00"),
            is_frequent=True,
            default_tooth_condition="filled",
        )

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "ORAL1", "email": "oral@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    def test_list_procedures(self):
        r = self.client.get("/api/v1/oral/procedures/")
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(len(r.json()["results"]), 1)

    def test_bulk_create_treatments(self):
        r = self.client.post(
            "/api/v1/oral/treatments/bulk/",
            {
                "patient": self.patient.pk,
                "procedure": self.procedure.pk,
                "tooth_numbers": [46, 47],
                "status": "planned",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(len(r.json()), 2)
        self.assertEqual(
            OralTreatment.all_tenants.filter(patient=self.patient).count(),
            2,
        )

    def test_complete_treatment_syncs_chart(self):
        t = OralTreatment.all_tenants.create(
            tenant=self.tenant,
            patient=self.patient,
            procedure=self.procedure,
            tooth_numbers=[46],
            status=OralTreatment.Status.PLANNED,
            phase="treatment",
            unit_price=Decimal("850"),
            session_date=date.today(),
        )
        r = self.client.patch(
            f"/api/v1/oral/treatments/{t.pk}/",
            {"status": "completed", "performed_at": date.today().isoformat()},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        chart = PatientOralChart.all_tenants.get(patient=self.patient)
        self.assertEqual(chart.teeth_state["46"]["condition"], "filled")

    def test_chart_endpoint(self):
        r = self.client.get(f"/api/v1/oral/charts/{self.patient.pk}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["patient"], self.patient.pk)

    def test_other_tenant_cannot_read_chart(self):
        other_dept = Department.objects.create(tenant=self.other, key="doc", name="Doc")
        other_dept.permissions.set(Permission.objects.filter(codename="oral.read"))
        other_user = User.all_tenants.create(
            tenant=self.other, email="x@other.test", department=other_dept, is_active=True
        )
        other_user.set_password("StaffPass1!X")
        other_user.save()
        c = APIClient()
        login = c.post(
            "/api/v1/auth/login/",
            {"customer_code": "ORAL2", "email": "x@other.test", "password": "StaffPass1!X"},
            format="json",
        )
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
        r = c.get(f"/api/v1/oral/charts/{self.patient.pk}/")
        self.assertIn(r.status_code, (403, 404))

    def test_create_procedure_links_product(self):
        set_module_subscriptions(self.tenant, ["patients", "oral", "products"], module_parents={"oral": "patients"})
        r = self.client.post(
            "/api/v1/oral/procedures/",
            {
                "code": "TEST-X",
                "name": "Test Procedure",
                "category": "treatment",
                "default_price": "999.00",
                "is_active": True,
                "sort_order": 99,
                "is_frequent": False,
                "default_tooth_condition": "",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertIsNotNone(r.json().get("product"))
        self.assertEqual(r.json()["product_name"], "Test Procedure")

    def test_read_only_cannot_create_procedure(self):
        read_dept = Department.objects.create(tenant=self.tenant, key="ro", name="ReadOnly")
        read_dept.permissions.set(Permission.objects.filter(codename="oral.read"))
        user = User.all_tenants.create(
            tenant=self.tenant, email="read@clinic.test", department=read_dept, is_active=True
        )
        user.set_password("StaffPass1!X")
        user.save()
        c = APIClient()
        login = c.post(
            "/api/v1/auth/login/",
            {"customer_code": "ORAL1", "email": "read@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")
        r = c.post("/api/v1/oral/procedures/", {"code": "X", "name": "X", "category": "treatment"}, format="json")
        self.assertEqual(r.status_code, 403)
