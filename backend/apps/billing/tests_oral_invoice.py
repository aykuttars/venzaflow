from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.billing.models import Invoice
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.oral.models import OralTreatment, ProcedureCatalog
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

from django.contrib.auth import get_user_model

User = get_user_model()


class OralInvoiceApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(customer_code="BILLORAL", name="Clinic", max_users=5)
        set_module_subscriptions(
            cls.tenant,
            ["patients", "oral", "billing", "products"],
            module_parents={"oral": "patients"},
        )
        cls.dept = Department.objects.create(tenant=cls.tenant, key="cash", name="Cashier")
        cls.dept.permissions.set(
            Permission.objects.filter(
                codename__in=(
                    "oral.read",
                    "oral.write",
                    "billing.read",
                    "billing.write",
                    "patients.read",
                )
            )
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="cash@clinic.test", department=cls.dept, is_active=True
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
        )
        from apps.oral.services.procedure_product import ensure_procedure_product

        ensure_procedure_product(cls.procedure)

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "BILLORAL", "email": "cash@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    def _completed_treatment(self) -> OralTreatment:
        return OralTreatment.all_tenants.create(
            tenant=self.tenant,
            patient=self.patient,
            procedure=self.procedure,
            tooth_numbers=[46],
            status=OralTreatment.Status.COMPLETED,
            phase="treatment",
            unit_price=Decimal("850.00"),
            session_date=date.today(),
            performed_at=date.today(),
        )

    def test_create_invoice_from_treatments(self):
        t = self._completed_treatment()
        r = self.client.post(
            "/api/v1/billing/invoices/from-oral-treatments/",
            {
                "patient": self.patient.pk,
                "treatment_ids": [t.pk],
                "discount_percent": "10.00",
                "e_document_type": "auto",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        data = r.json()
        self.assertEqual(len(data["lines"]), 1)
        self.assertEqual(data["subtotal_before_discount"], "850.00")
        self.assertEqual(data["discount_amount"], "85.00")
        self.assertEqual(data["total"], "765.00")
        self.assertEqual(data["e_document_type"], "auto")
        self.assertEqual(data["resolved_e_document_type"], "earsiv")
        t.refresh_from_db()
        self.assertIsNotNone(t.invoice_id)

    def test_cannot_invoice_twice(self):
        t = self._completed_treatment()
        self.client.post(
            "/api/v1/billing/invoices/from-oral-treatments/",
            {"patient": self.patient.pk, "treatment_ids": [t.pk]},
            format="json",
        )
        r = self.client.post(
            "/api/v1/billing/invoices/from-oral-treatments/",
            {"patient": self.patient.pk, "treatment_ids": [t.pk]},
            format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_unbilled_filter(self):
        t = self._completed_treatment()
        OralTreatment.all_tenants.create(
            tenant=self.tenant,
            patient=self.patient,
            procedure=self.procedure,
            tooth_numbers=[47],
            status=OralTreatment.Status.COMPLETED,
            phase="treatment",
            unit_price=Decimal("850.00"),
            session_date=date.today(),
        )
        self.client.post(
            "/api/v1/billing/invoices/from-oral-treatments/",
            {"patient": self.patient.pk, "treatment_ids": [t.pk]},
            format="json",
        )
        r = self.client.get(
            f"/api/v1/oral/treatments/?patient={self.patient.pk}&unbilled=1&status=completed"
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()["results"]), 1)

    def test_payment_marks_invoice_paid(self):
        t = self._completed_treatment()
        inv_r = self.client.post(
            "/api/v1/billing/invoices/from-oral-treatments/",
            {"patient": self.patient.pk, "treatment_ids": [t.pk]},
            format="json",
        )
        inv_id = inv_r.json()["id"]
        pay_r = self.client.post(
            "/api/v1/billing/payments/",
            {
                "invoice": inv_id,
                "amount": inv_r.json()["total"],
                "paid_at": "2026-05-20T12:00:00Z",
                "method": "cash",
            },
            format="json",
        )
        self.assertEqual(pay_r.status_code, 201, pay_r.content)
        invoice = Invoice.all_tenants.get(pk=inv_id)
        self.assertEqual(invoice.status, Invoice.Status.PAID)

    def test_none_e_document_skips_sign_task_when_signing_enabled(self):
        set_module_subscriptions(
            self.tenant,
            ["patients", "oral", "billing", "products", "signing"],
            module_parents={"oral": "patients"},
        )
        t = self._completed_treatment()
        r = self.client.post(
            "/api/v1/billing/invoices/from-oral-treatments/",
            {
                "patient": self.patient.pk,
                "treatment_ids": [t.pk],
                "e_document_type": "none",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201, r.content)
        from apps.signing.models import SignTask

        self.assertFalse(
            SignTask.objects.filter(
                tenant=self.tenant,
                content_type__model="invoice",
                object_id=r.json()["id"],
            ).exists()
        )
