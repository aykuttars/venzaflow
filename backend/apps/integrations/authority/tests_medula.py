from __future__ import annotations

import base64
from datetime import date
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings
from lxml import etree

from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.integrations.authority.medula import MedulaAdapter
from apps.integrations.authority.medula_constants import MEDULA_TEST_TESIS_KODU
from apps.integrations.authority.medula_xml import build_erecete_xml
from apps.prescriptions.models import DrugCatalog, Prescription, PrescriptionLine
from apps.signing.models import SignTask
from apps.signing.services import medula_xades as MX
from apps.signing.tests import _generate_self_signed_cert
from apps.tenants.models import Tenant

from django.contrib.auth import get_user_model

User = get_user_model()


class MedulaXmlTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.tenant = Tenant.objects.create(customer_code="MEDXML", name="Medula XML")
        cls.doctor = User.all_tenants.create(
            tenant=cls.tenant,
            email="dr@medula.test",
            first_name="Demo",
            last_name="Hekim",
            tckn="99999999990",
        )
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
            doctor=cls.doctor,
            diagnosis_code="K02.1",
            diagnosis_text="Diş çürüğü",
            prescription_type=Prescription.PrescriptionType.NORMAL,
            provision_type=Prescription.ProvisionType.SGK,
            status=Prescription.Status.READY,
            prescription_no="TEST-RX-1",
        )
        PrescriptionLine.all_tenants.create(
            tenant=cls.tenant,
            prescription=cls.rx,
            drug=drug,
            drug_barkod=drug.barkod,
            drug_name=drug.name,
            box_count=1,
            dose="1x1",
            frequency="Günde 2",
            period_days=7,
        )

    def test_build_erecete_xml_contains_required_fields(self):
        xml = build_erecete_xml(self.rx, tesis_kodu=MEDULA_TEST_TESIS_KODU)
        root = etree.fromstring(xml)
        ns = root.nsmap[None]
        self.assertEqual(root.find(f"{{{ns}}}tcKimlikNo").text, "22222222220")
        self.assertEqual(root.find(f"{{{ns}}}doktorTcKimlikNo").text, "99999999990")
        self.assertEqual(root.find(f"{{{ns}}}doktorBransKodu").text, "9999")
        drugs = root.findall(f"{{{ns}}}ereceteIlacListesi")
        self.assertEqual(len(drugs), 1)


class MedulaEnvelopingXadesTests(TestCase):
    def test_enveloping_signature_roundtrip(self):
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.x509 import load_der_x509_certificate

        payload = b'<?xml version="1.0"?><erecete><test>1</test></erecete>'
        cert_der, key = _generate_self_signed_cert()
        prepared = MX.prepare_enveloping_xades(
            payload, cert_der, signing_time="2026-05-20T12:00:00+03:00"
        )
        signature = key.sign(prepared.signed_info_c14n, padding.PKCS1v15(), hashes.SHA256())
        final_xml = MX.inject_enveloping_signature(prepared.signed_document_template, signature)

        from apps.signing.services.xades import DS

        root = etree.fromstring(final_xml)
        sig_value = root.find(f"{{{DS}}}SignatureValue")
        self.assertTrue(sig_value.text)
        signed_info = root.find(f"{{{DS}}}SignedInfo")
        si_c14n = etree.tostring(signed_info, method="c14n", exclusive=True)
        load_der_x509_certificate(cert_der).public_key().verify(
            base64.b64decode(sig_value.text), si_c14n, padding.PKCS1v15(), hashes.SHA256()
        )


class MedulaAdapterTests(TestCase):
    def test_submit_calls_soap_client(self):
        adapter = MedulaAdapter(
            {
                "username": "99999999990",
                "password": "99999999990",
                "tesis_kodu": "11068891",
            },
            environment="test",
        )
        tenant = Tenant.objects.create(customer_code="MADP", name="Medula Adapter")
        doctor = User.all_tenants.create(
            tenant=tenant, email="d@med.test", tckn="99999999990"
        )
        patient = Customer.all_tenants.create(
            tenant=tenant,
            kind=Customer.Kind.PATIENT,
            first_name="A",
            last_name="B",
            tckn="22222222220",
            home_address=SAMPLE_HOME_ADDRESS,
        )
        rx = Prescription.all_tenants.create(
            tenant=tenant,
            patient=patient,
            doctor=doctor,
            status=Prescription.Status.READY,
        )
        from django.contrib.contenttypes.models import ContentType

        ct = ContentType.objects.get_for_model(Prescription)
        task = SignTask.all_tenants.create(
            tenant=tenant,
            document_type=SignTask.DocumentType.ERECETE,
            title="Rx",
            content_type=ct,
            object_id=rx.id,
        )
        with patch.object(
            adapter,
            "_client",
            return_value=MagicMock(
                imzali_erecete_giris=MagicMock(
                    return_value={"sonucKodu": "0", "ereceteNo": "ERX1234567890"}
                )
            ),
        ):
            result = adapter.submit(task, signed_document=b"<signed/>")
        self.assertEqual(result.external_reference, "ERX1234567890")
        self.assertEqual(result.provider, "medula")

    @override_settings(AUTHORITY_MOCK=False)
    def test_registry_resolves_medula_for_tenant_routing(self):
        from apps.common.secretbox import encrypt_json
        from apps.integrations.authority.registry import get_authority_adapter
        from apps.signing.models import DocumentFamily, DocumentRouting, Environment, IntegrationConnection

        tenant = Tenant.objects.create(customer_code="MRT", name="Routing")
        conn = IntegrationConnection.all_tenants.create(
            tenant=tenant,
            provider_key="medula",
            environment=Environment.TEST,
            display_name="Medula",
            credentials_encrypted=encrypt_json(
                {
                    "username": "99999999990",
                    "password": "99999999990",
                    "tesis_kodu": "11068891",
                }
            ),
            is_active=True,
        )
        DocumentRouting.all_tenants.create(
            tenant=tenant, document_family=DocumentFamily.ERECETE, connection=conn
        )
        task = SignTask.all_tenants.create(
            tenant=tenant, document_type=SignTask.DocumentType.ERECETE, title="t"
        )
        adapter = get_authority_adapter(task)
        self.assertIsInstance(adapter, MedulaAdapter)
