from __future__ import annotations

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.prescriptions.models import DrugCatalog, Prescription
from apps.prescriptions.seed_data import ensure_drug_catalog
from apps.signing.models import SignTask
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

from django.contrib.auth import get_user_model

User = get_user_model()


class PrescriptionApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(customer_code="RX1", name="Rx Clinic", max_users=5)
        set_module_subscriptions(cls.tenant, ["patients", "signing"], module_parents={})
        cls.dept = Department.objects.create(tenant=cls.tenant, key="doc", name="Doctor")
        cls.dept.permissions.set(
            Permission.objects.filter(
                codename__in=(
                    "patients.read",
                    "patients.write",
                    "prescriptions.read",
                    "prescriptions.write",
                    "signing.read",
                    "signing.write",
                )
            )
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="doc@rx.test", department=cls.dept, is_active=True
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

        cls.patient = Customer.all_tenants.create(
            tenant=cls.tenant,
            kind=Customer.Kind.PATIENT,
            first_name="Elif",
            last_name="Kaya",
            mobile_phone="5321112233",
            tckn="22222222220",
            home_address=SAMPLE_HOME_ADDRESS,
        )
        ensure_drug_catalog(cls.tenant)
        cls.drug = DrugCatalog.all_tenants.filter(tenant=cls.tenant).first()

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "RX1", "email": "doc@rx.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    def test_create_and_finalize_prescription(self):
        create = self.client.post(
            "/api/v1/prescriptions/",
            {
                "patient": self.patient.pk,
                "diagnosis_code": "K02.1",
                "diagnosis_text": "Diş çürüğü",
                "prescription_type": "normal",
                "provision_type": "sgk",
                "lines": [
                    {
                        "drug": self.drug.pk,
                        "drug_name": self.drug.name,
                        "box_count": 1,
                        "dose": "1x1",
                        "frequency": "Günde 2",
                        "period_days": 7,
                        "route": "oral",
                        "usage_instruction": "Tok karnına",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(create.status_code, 201, create.content)
        rx_id = create.json()["id"]
        fin = self.client.post(f"/api/v1/prescriptions/{rx_id}/finalize/", format="json")
        self.assertEqual(fin.status_code, 200, fin.content)
        self.assertEqual(fin.json()["status"], "ready")
        self.assertTrue(
            SignTask.objects.filter(
                tenant=self.tenant,
                document_type=SignTask.DocumentType.ERECETE,
                object_id=rx_id,
            ).exists()
        )

    def test_drug_search_requires_three_chars(self):
        r = self.client.get("/api/v1/prescriptions/drugs/?search=pa")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["results"]), 0)
        r2 = self.client.get("/api/v1/prescriptions/drugs/?search=par")
        self.assertGreaterEqual(len(r2.json()["results"]), 1)

    def test_finalize_requires_tckn(self):
        patient = Customer.all_tenants.create(
            tenant=self.tenant,
            kind=Customer.Kind.PATIENT,
            first_name="No",
            last_name="Tckn",
            mobile_phone="5320000000",
            tckn="",
            home_address=SAMPLE_HOME_ADDRESS,
        )
        create = self.client.post(
            "/api/v1/prescriptions/",
            {
                "patient": patient.pk,
                "diagnosis_code": "K02.1",
                "lines": [
                    {
                        "drug_name": "Test",
                        "dose": "1x1",
                        "frequency": "Günde 1",
                        "usage_instruction": "Test",
                    }
                ],
            },
            format="json",
        )
        rx_id = create.json()["id"]
        fin = self.client.post(f"/api/v1/prescriptions/{rx_id}/finalize/", format="json")
        self.assertEqual(fin.status_code, 400)

    def test_preview_returns_html(self):
        rx = Prescription.all_tenants.create(
            tenant=self.tenant,
            patient=self.patient,
            doctor=self.user,
            diagnosis_code="K02.1",
            diagnosis_text="Test",
            status=Prescription.Status.DRAFT,
        )
        r = self.client.get(f"/api/v1/prescriptions/{rx.pk}/preview/")
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/html", r["Content-Type"])
        self.assertIn(b"RE\xc3\x87ETE", r.content)
