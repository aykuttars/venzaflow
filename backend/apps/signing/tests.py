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

        cert_der, private_key = _generate_self_signed_cert()
        cert_b64 = base64.b64encode(cert_der).decode("ascii")

        # e-Fatura is XAdES: the certificate is required at prepare time so the
        # SigningCertificate digest can be embedded into SignedProperties.
        prep = self.client.post(
            f"/api/v1/sign/tasks/{task_id}/prepare/",
            {"certificate_der_base64": cert_b64},
            format="json",
        )
        self.assertEqual(prep.status_code, 200, prep.content)
        self.assertIn("data_to_sign_base64", prep.data)
        self.assertEqual(prep.data["algorithm"], "SHA256_RSA_PKCS")

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
        self.assertEqual(complete.data["status"], "submitted")
        self.assertTrue(complete.data["external_reference"])

        task = SignTask.objects.get(pk=task_id)
        self.assertEqual(task.status, SignTask.Status.SUBMITTED)
        self.assertEqual(task.provider, "mock")
        # The stored artifact is the final signed UBL-TR XML.
        self.assertIn("<ds:SignatureValue", task.signed_document)
        self.assertIn("Invoice", task.signed_document)

    def test_xades_prepare_requires_certificate(self):
        list_r = self.client.get("/api/v1/sign/tasks/?document_type=efatura")
        task_id = self._results(list_r)[0]["id"]
        prep = self.client.post(f"/api/v1/sign/tasks/{task_id}/prepare/", {}, format="json")
        self.assertEqual(prep.status_code, 400, prep.content)

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


class IntegrationConfigTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        Permission.objects.get_or_create(codename="signing.read", defaults={"name": "r"})
        Permission.objects.get_or_create(codename="signing.write", defaults={"name": "w"})
        cls.tenant = Tenant.objects.create(customer_code="CFG1", name="Cfg Clinic", max_users=5)
        set_module_subscriptions(cls.tenant, ["signing"])
        cls.dept = Department.objects.create(tenant=cls.tenant, key="admin", name="Admin")
        cls.dept.permissions.set(
            Permission.objects.filter(codename__in=("signing.read", "signing.write"))
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="cfg@clinic.test", department=cls.dept, is_active=True
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "CFG1", "email": "cfg@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.data['access']}")

    def test_secretbox_roundtrip_and_mask(self):
        from apps.common.secretbox import decrypt_json, encrypt_json, mask_secret

        token = encrypt_json({"api_key": "supersecret123"})
        self.assertNotIn("supersecret", token)
        self.assertEqual(decrypt_json(token)["api_key"], "supersecret123")
        self.assertTrue(mask_secret("supersecret123").endswith("t123"))

    def test_create_connection_masks_secret(self):
        r = self.client.post(
            "/api/v1/sign/integration/connections/",
            {
                "display_name": "Nilvera Test",
                "provider_key": "nilvera",
                "environment": "test",
                "credentials": {"api_key": "secret-abcd"},
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        self.assertNotIn("secret-abcd", r.content.decode())
        self.assertTrue(r.data["credentials"]["api_key"]["set"])
        self.assertEqual(r.data["provider_display"], "Nilvera")

    def test_routing_resolves_adapter(self):
        from django.test import override_settings

        from apps.integrations.authority.nilvera import NilveraAdapter
        from apps.integrations.authority.registry import get_authority_adapter
        from apps.signing.models import IntegrationConnection
        from apps.signing.services.integration_config import resolve_connection

        conn = IntegrationConnection.all_tenants.create(
            tenant=self.tenant, provider_key="nilvera", environment="test"
        )
        r = self.client.put(
            "/api/v1/sign/integration/routing/",
            {"routings": [{"document_family": "efatura", "connection": conn.id}]},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(resolve_connection(self.tenant, "efatura").id, conn.id)

        task = SignTask.all_tenants.create(
            tenant=self.tenant, document_type=SignTask.DocumentType.EFATURA, title="t"
        )
        with override_settings(AUTHORITY_MOCK=False):
            adapter = get_authority_adapter(task)
        self.assertIsInstance(adapter, NilveraAdapter)

    def test_profile_update(self):
        r = self.client.put(
            "/api/v1/sign/integration/",
            {"supplier_vkn": "1234567801", "supplier_title": "Klinik A.Ş."},
            format="json",
        )
        self.assertEqual(r.status_code, 200, r.content)

        from apps.signing.services.integration_config import supplier_dict

        self.assertEqual(supplier_dict(self.tenant)["vkn"], "1234567801")


class XadesRoundTripTests(TestCase):
    """Validates the XAdES-BES enveloped signature cryptographically, without
    any authority access: digests recompute correctly and the SignatureValue
    verifies against the canonicalized SignedInfo."""

    def _sample_ubl(self) -> bytes:
        from lxml import etree

        from apps.signing.services import xades as X

        nsmap = {None: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2", "ext": X.EXT}
        root = etree.Element("{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice", nsmap=nsmap)
        ext = etree.SubElement(root, f"{{{X.EXT}}}UBLExtensions")
        one = etree.SubElement(ext, f"{{{X.EXT}}}UBLExtension")
        etree.SubElement(one, f"{{{X.EXT}}}ExtensionContent")
        cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
        idn = etree.SubElement(root, f"{{{cbc}}}ID", nsmap={"cbc": cbc})
        idn.text = "INV-XADES-1"
        return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=False)

    def test_signature_and_digests_verify(self):
        import base64 as b64
        import hashlib

        from cryptography.hazmat.primitives import hashes as H
        from cryptography.hazmat.primitives.asymmetric import padding as P
        from cryptography.x509 import load_der_x509_certificate
        from lxml import etree

        from apps.signing.services import xades as X

        cert_der, key = _generate_self_signed_cert()
        prepared = X.prepare_xades(self._sample_ubl(), cert_der, signing_time="2026-06-11T12:00:00+03:00")

        signature = key.sign(prepared.signed_info_c14n, P.PKCS1v15(), H.SHA256())
        final_xml = X.inject_signature(prepared.signed_document_template, signature)

        root = etree.fromstring(final_xml)
        sig = root.find(f".//{{{X.DS}}}Signature")
        self.assertIsNotNone(sig)

        # 1) SignatureValue verifies over exclusive-C14N(SignedInfo).
        signed_info = sig.find(f"{{{X.DS}}}SignedInfo")
        si_c14n = etree.tostring(signed_info, method="c14n", exclusive=True)
        self.assertEqual(si_c14n, prepared.signed_info_c14n)
        sig_value = b64.b64decode(sig.find(f"{{{X.DS}}}SignatureValue").text)
        load_der_x509_certificate(cert_der).public_key().verify(
            sig_value, si_c14n, P.PKCS1v15(), H.SHA256()
        )

        # 2) SignedProperties reference digest matches.
        sp = root.find(f".//{{{X.XADES}}}SignedProperties")
        sp_digest = b64.b64encode(hashlib.sha256(
            etree.tostring(sp, method="c14n", exclusive=True)
        ).digest()).decode()
        refs = signed_info.findall(f"{{{X.DS}}}Reference")
        sp_ref = next(r for r in refs if (r.get("Type") or "").endswith("SignedProperties"))
        self.assertEqual(sp_ref.find(f"{{{X.DS}}}DigestValue").text, sp_digest)

        # 3) Enveloped document digest matches after removing the signature.
        doc_ref = next(r for r in refs if r.get("URI") == "")
        sig.getparent().remove(sig)
        doc_digest = b64.b64encode(hashlib.sha256(
            etree.tostring(root, method="c14n", exclusive=True)
        ).digest()).decode()
        self.assertEqual(doc_ref.find(f"{{{X.DS}}}DigestValue").text, doc_digest)
