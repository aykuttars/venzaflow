from __future__ import annotations

import base64
from datetime import date, timedelta
from decimal import Decimal

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.asymmetric.rsa import generate_private_key
from cryptography.x509 import Name, NameAttribute, CertificateBuilder, SubjectAlternativeName, DNSName
from cryptography.x509.oid import NameOID
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.billing.models import Invoice
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.signing.models import SignTask
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

from django.contrib.auth import get_user_model

User = get_user_model()


def _generate_self_signed_cert() -> tuple[bytes, object]:
    key = generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = Name(
        [
            NameAttribute(NameOID.COUNTRY_NAME, "TR"),
            NameAttribute(NameOID.ORGANIZATION_NAME, "Test Clinic"),
            NameAttribute(NameOID.COMMON_NAME, "test-signer.local"),
        ]
    )
    cert = (
        CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(1)
        .not_valid_before(timezone.now() - timedelta(days=1))
        .not_valid_after(timezone.now() + timedelta(days=365))
        .add_extension(SubjectAlternativeName([DNSName("test-signer.local")]), critical=False)
        .sign(key, hashes.SHA256())
    )
    return cert.public_bytes(serialization.Encoding.DER), key


class SigningApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})
        Permission.objects.get_or_create(
            codename="signing.read", defaults={"name": "View signing tasks"}
        )
        Permission.objects.get_or_create(
            codename="signing.write", defaults={"name": "Manage signing tasks"}
        )

        cls.tenant = Tenant.objects.create(customer_code="SIGN1", name="Signing Clinic", max_users=5)
        set_module_subscriptions(cls.tenant, ["billing", "signing"])
        cls.dept = Department.objects.create(tenant=cls.tenant, key="admin", name="Admin")
        cls.dept.permissions.set(
            Permission.objects.filter(
                codename__in=("signing.read", "signing.write", "billing.read", "billing.write")
            )
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="sign@clinic.test", department=cls.dept, is_active=True
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

        cls.customer = Customer.all_tenants.create(
            tenant=cls.tenant,
            kind=Customer.Kind.CUSTOMER,
            first_name="Ali",
            last_name="Veli",
            mobile_phone="5320000000",
            email="ali@test.com",
            home_address=SAMPLE_HOME_ADDRESS,
        )
        cls.invoice = Invoice.all_tenants.create(
            tenant=cls.tenant,
            number="INV-001",
            customer=cls.customer,
            issued_at=date.today(),
            status=Invoice.Status.DRAFT,
            total=Decimal("100.00"),
        )

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "SIGN1", "email": "sign@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.token = r.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def _results(self, response):
        data = response.data
        if isinstance(data, list):
            return data
        return data.get("results", [])

    def test_list_syncs_efatura_tasks_from_invoice(self):
        r = self.client.get("/api/v1/sign/tasks/?document_type=efatura")
        self.assertEqual(r.status_code, 200, r.content)
        items = self._results(r)
        self.assertGreaterEqual(len(items), 1)
        self.assertEqual(items[0]["document_type"], "efatura")

    def test_prepare_sign_complete_flow(self):
        list_r = self.client.get("/api/v1/sign/tasks/?document_type=efatura")
        task_id = self._results(list_r)[0]["id"]

        prep = self.client.post(f"/api/v1/sign/tasks/{task_id}/prepare/", {}, format="json")
        self.assertEqual(prep.status_code, 200, prep.content)
        self.assertIn("data_to_sign_base64", prep.data)
        self.assertEqual(prep.data["algorithm"], "SHA256_RSA_PKCS")

        payload = base64.b64decode(prep.data["data_to_sign_base64"])
        cert_der, private_key = _generate_self_signed_cert()
        signature = private_key.sign(payload, padding.PKCS1v15(), hashes.SHA256())

        complete = self.client.post(
            f"/api/v1/sign/tasks/{task_id}/complete/",
            {
                "signature_base64": base64.b64encode(signature).decode("ascii"),
                "certificate_der_base64": base64.b64encode(cert_der).decode("ascii"),
            },
            format="json",
        )
        self.assertEqual(complete.status_code, 200, complete.content)
        self.assertEqual(complete.data["status"], "submitted")
        self.assertTrue(complete.data["external_reference"])

        task = SignTask.objects.get(pk=task_id)
        self.assertEqual(task.status, SignTask.Status.SUBMITTED)

    def test_module_not_enabled_returns_403(self):
        other = Tenant.objects.create(customer_code="NOSIGN", name="No Sign", max_users=5)
        set_module_subscriptions(other, ["billing"])
        dept = Department.objects.create(tenant=other, key="d", name="D")
        dept.permissions.set(Permission.objects.filter(codename__in=("billing.read",)))
        user = User.all_tenants.create(
            tenant=other, email="nosign@test.com", department=dept, is_active=True
        )
        user.set_password("StaffPass1!X")
        user.save()
        client = APIClient()
        login = client.post(
            "/api/v1/auth/login/",
            {"customer_code": "NOSIGN", "email": "nosign@test.com", "password": "StaffPass1!X"},
            format="json",
        )
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        r = client.get("/api/v1/sign/tasks/?document_type=efatura")
        self.assertEqual(r.status_code, 403)
