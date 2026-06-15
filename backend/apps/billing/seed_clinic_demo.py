"""Demo billing + e-imza samples for clinic tenant 1000."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.utils import timezone

from apps.billing.models import Invoice, Payment
from apps.billing.services.oral_invoice import create_invoice_from_treatments
from apps.common.secretbox import encrypt_json
from apps.customers.models import Customer
from apps.oral.models import OralTreatment, ProcedureCatalog
from apps.signing.models import (
    DocumentFamily,
    DocumentRouting,
    Environment,
    IntegrationConnection,
    SignTask,
    SigningMode,
    TenantSigningProfile,
)
from apps.signing.services.task_factory import sync_erecete_tasks
from apps.tenants.models import Tenant

DEMO_INVOICE_EARSIV = "DEMO-EARSIV-1"
DEMO_INVOICE_EARSIV_2 = "DEMO-EARSIV-2"


def ensure_clinic_signing_integration(tenant: Tenant) -> IntegrationConnection:
    profile, _ = TenantSigningProfile.objects.update_or_create(
        tenant=tenant,
        defaults={
            "supplier_vkn": "1234567890",
            "supplier_title": "Demo Klinik Diş Merkezi A.Ş.",
            "supplier_tax_office": "Kadıköy",
            "supplier_city": "İstanbul",
            "supplier_district": "Kadıköy",
            "supplier_street": "Bağdat Cad. No:100",
            "supplier_country": "Türkiye",
        },
    )
    _ = profile  # noqa: F841 — side effect is profile upsert

    conn, _ = IntegrationConnection.all_tenants.update_or_create(
        tenant=tenant,
        provider_key="mock",
        environment=Environment.TEST,
        defaults={
            "display_name": "Mock Entegratör (Demo)",
            "signing_mode": SigningMode.CLIENT_XADES,
            "credentials_encrypted": encrypt_json({"api_key": "demo-mock-key-1000"}),
            "is_active": True,
            "status": IntegrationConnection.Status.OK,
            "status_message": "Demo bağlantı — seed",
        },
    )
    for family in (
        DocumentFamily.EFATURA,
        DocumentFamily.EARSIV,
        DocumentFamily.ERECETE,
    ):
        DocumentRouting.all_tenants.update_or_create(
            tenant=tenant,
            document_family=family,
            defaults={"connection": conn},
        )
    return conn


def _completed_unbilled(tenant: Tenant, patient: Customer) -> list[int]:
    return list(
        OralTreatment.all_tenants.filter(
            tenant=tenant,
            patient=patient,
            status=OralTreatment.Status.COMPLETED,
            invoice__isnull=True,
        ).values_list("id", flat=True)
    )


def ensure_clinic_billing_signing_demo(tenant: Tenant) -> dict[str, int]:
    """Create one sample per oral→billing→signing path (idempotent demo numbers)."""
    ensure_clinic_signing_integration(tenant)
    today = date.today()
    stats = {"invoices": 0, "payments": 0, "sign_tasks": 0, "erecete_tasks": 0}

    elif_patient = Customer.all_tenants.filter(tenant=tenant, tckn="22222222220").first()
    if elif_patient:
        exam = ProcedureCatalog.all_tenants.filter(tenant=tenant, code="EXAM").first()
        if exam:
            OralTreatment.all_tenants.update_or_create(
                tenant=tenant,
                patient=elif_patient,
                procedure=exam,
                tooth_numbers=[21],
                session_date=today,
                defaults={
                    "status": OralTreatment.Status.COMPLETED,
                    "phase": exam.category,
                    "unit_price": exam.default_price,
                    "performed_at": today,
                    "notes": "Demo e-Reçete örneği",
                },
            )

    ragip = Customer.all_tenants.filter(tenant=tenant, tckn="11111111110").first()
    if ragip and not Invoice.all_tenants.filter(tenant=tenant, number=DEMO_INVOICE_EARSIV).exists():
        treatment_ids = _completed_unbilled(tenant, ragip)
        if treatment_ids:
            create_invoice_from_treatments(
                tenant,
                ragip,
                treatment_ids,
                discount_percent=Decimal("10"),
                number=DEMO_INVOICE_EARSIV,
                notes="Demo: tamamlanan tedavilerden e-Arşiv faturası (%10 iskonto)",
                e_document_type=Invoice.EDocumentType.AUTO,
            )
            stats["invoices"] += 1

    mehmet = Customer.all_tenants.filter(tenant=tenant, tckn="33333333330").first()
    if mehmet and not Invoice.all_tenants.filter(tenant=tenant, number=DEMO_INVOICE_EARSIV_2).exists():
        treatment_ids = _completed_unbilled(tenant, mehmet)
        if treatment_ids:
            inv = create_invoice_from_treatments(
                tenant,
                mehmet,
                treatment_ids,
                number=DEMO_INVOICE_EARSIV_2,
                notes="Demo: kron tedavisi — ödeme örneği",
                e_document_type=Invoice.EDocumentType.EARSIV,
            )
            stats["invoices"] += 1
            if not Payment.all_tenants.filter(tenant=tenant, invoice=inv).exists():
                Payment.all_tenants.create(
                    tenant=tenant,
                    invoice=inv,
                    amount=inv.total,
                    paid_at=timezone.now(),
                    method="card",
                )
                inv.status = Invoice.Status.PAID
                inv.save(update_fields=["status"])
                stats["payments"] += 1

    stats["sign_tasks"] = SignTask.objects.filter(
        tenant=tenant,
        content_type__model="invoice",
    ).count()
    stats["erecete_tasks"] = sync_erecete_tasks(tenant)
    stats["sign_tasks"] = SignTask.objects.filter(tenant=tenant).count()
    return stats
