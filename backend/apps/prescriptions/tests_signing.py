from __future__ import annotations

import base64
from datetime import date

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.prescriptions.models import DrugCatalog, Prescription, PrescriptionLine
from apps.prescriptions.services.prescription import finalize_prescription
from apps.signing.models import SignTask
from apps.signing.tests import _generate_self_signed_cert
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

from django.contrib.auth import get_user_model

User = get_user_model()


class PrescriptionSigningFlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})
        cls.tenant = Tenant.objects.create(customer_code="RXSIGN", name="Rx Sign", max_users=5)
        set_module_subscriptions(cls.tenant, ["patients", "signing"])
        cls.dept = Department.objects.create(tenant=cls.tenant, key="doc", name="Doc")
        cls.dept.permissions.set(
            Permission.objects.filter(codename__in=("signing.read", "signing.write"))
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="sign@rx.test", department=cls.dept, is_active=True
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()
        cls.patient = Customer.all_tenants.create(
            tenant=cls.tenant,
            kind=Customer.Kind.PATIENT,
            first_name="Elif",
            last_name="Kaya",
            tckn="22222222220",
            birth_date=date(1990, 1, 1),
            home_address=SAMPLE_HOME_ADDRESS,
        )
        drug = DrugCatalog.all_tenants.create(
            tenant=cls.tenant, barkod="8699550023456", name="Amoksisilin"
        )
        cls.rx = Prescription.all_tenants.create(
            tenant=cls.tenant,
            patient=cls.patient,
            doctor=cls.user,
            diagnosis_code="K02.1",
            diagnosis_text="Test",
            status=Prescription.Status.DRAFT,
        )
        PrescriptionLine.all_tenants.create(
            tenant=cls.tenant,
            prescription=cls.rx,
            drug=drug,
            drug_name=drug.name,
            dose="1x1",
            frequency="Günde 2",
            usage_instruction="Tok karnına",
        )
        finalize_prescription(cls.rx, actor=cls.user)

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "RXSIGN", "email": "sign@rx.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    def test_erecete_prepare_complete_updates_prescription(self):
        list_r = self.client.get("/api/v1/sign/tasks/?document_type=erecete")
        task_id = list_r.json()["results"][0]["id"]
        cert_der, private_key = _generate_self_signed_cert()
        cert_b64 = base64.b64encode(cert_der).decode("ascii")
        prep = self.client.post(
            f"/api/v1/sign/tasks/{task_id}/prepare/",
            {"certificate_der_base64": cert_b64},
            format="json",
        )
        self.assertEqual(prep.status_code, 200, prep.content)
        payload = base64.b64decode(prep.data["data_to_sign_base64"])
        signature = private_key.sign(payload, padding.PKCS1v15(), hashes.SHA256())
        complete = self.client.post(
            f"/api/v1/sign/tasks/{task_id}/complete/",
            {
                "signature_base64": base64.b64encode(signature).decode("ascii"),
                "certificate_der_base64": cert_b64,
            },
            format="json",
        )
        self.assertEqual(complete.status_code, 200, complete.content)
        self.rx.refresh_from_db()
        self.assertEqual(self.rx.status, Prescription.Status.SUBMITTED)
        self.assertTrue(self.rx.medula_reference.startswith("MEDULA-MOCK"))
