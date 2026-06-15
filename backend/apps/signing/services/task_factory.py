from __future__ import annotations

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType

from apps.billing.models import Invoice
from apps.billing.services.oral_invoice import resolve_e_document_type
from apps.prescriptions.models import Prescription
from apps.signing.models import SignTask
from apps.tenants.models import Tenant


def _invoice_ct() -> ContentType:
    return ContentType.objects.get_for_model(Invoice)


def _prescription_ct() -> ContentType:
    return ContentType.objects.get_for_model(Prescription)


def _existing_source_ids(tenant: Tenant, document_type: str, content_type: ContentType) -> set[int]:
    return set(
        SignTask.objects.filter(
            tenant=tenant,
            document_type=document_type,
            content_type=content_type,
        ).values_list("object_id", flat=True)
    )


def invoice_eligible_for_signing(invoice: Invoice) -> bool:
    if resolve_e_document_type(invoice) == "none":
        return False
    if invoice.status not in (Invoice.Status.DRAFT, Invoice.Status.SENT):
        return False
    if not invoice.lines.exists():
        return False
    if Decimal(str(invoice.total or 0)) <= 0:
        return False
    return True


def sync_sign_task_for_invoice(tenant: Tenant, invoice: Invoice) -> bool:
    """Create a sign task for one invoice when eligible. Returns True if created."""
    if not invoice_eligible_for_signing(invoice):
        return False
    resolved = resolve_e_document_type(invoice)
    if resolved == Invoice.EDocumentType.EFATURA:
        document_type = SignTask.DocumentType.EFATURA
    elif resolved == Invoice.EDocumentType.EARSIV:
        document_type = SignTask.DocumentType.EARSIV
    else:
        return False
    return _create_invoice_sign_task(tenant, invoice, document_type)


def _create_invoice_sign_task(tenant: Tenant, invoice: Invoice, document_type: str) -> bool:
    ct = _invoice_ct()
    if SignTask.objects.filter(
        tenant=tenant,
        document_type=document_type,
        content_type=ct,
        object_id=invoice.id,
    ).exists():
        return False
    label = "e-Fatura" if document_type == SignTask.DocumentType.EFATURA else "e-Arşiv"
    SignTask.objects.create(
        tenant=tenant,
        document_type=document_type,
        title=f"{label} — {invoice.number}",
        description=f"Müşteri: {invoice.customer.first_name} {invoice.customer.last_name}".strip(),
        status=SignTask.Status.PENDING,
        content_type=ct,
        object_id=invoice.id,
        metadata={"invoice_number": invoice.number, "source": "billing.invoice"},
    )
    return True


def sync_efatura_tasks(tenant: Tenant) -> int:
    created = 0
    qs = (
        Invoice.objects.filter(tenant=tenant, status=Invoice.Status.DRAFT)
        .select_related("customer")
        .prefetch_related("lines")
    )
    for invoice in qs:
        if not invoice_eligible_for_signing(invoice):
            continue
        if resolve_e_document_type(invoice) != Invoice.EDocumentType.EFATURA:
            continue
        if _create_invoice_sign_task(tenant, invoice, SignTask.DocumentType.EFATURA):
            created += 1
    return created


def sync_earsiv_tasks(tenant: Tenant) -> int:
    created = 0
    qs = (
        Invoice.objects.filter(
            tenant=tenant,
            status__in=[Invoice.Status.DRAFT, Invoice.Status.SENT],
        )
        .select_related("customer")
        .prefetch_related("lines")
    )
    for invoice in qs:
        if not invoice_eligible_for_signing(invoice):
            continue
        if resolve_e_document_type(invoice) != Invoice.EDocumentType.EARSIV:
            continue
        if _create_invoice_sign_task(tenant, invoice, SignTask.DocumentType.EARSIV):
            created += 1
    return created


def sync_sign_task_for_prescription(tenant: Tenant, prescription: Prescription) -> bool:
    if prescription.status != Prescription.Status.READY:
        return False
    ct = _prescription_ct()
    if SignTask.objects.filter(
        tenant=tenant,
        document_type=SignTask.DocumentType.ERECETE,
        content_type=ct,
        object_id=prescription.id,
    ).exists():
        return False
    patient = prescription.patient
    line_count = prescription.lines.count()
    SignTask.objects.create(
        tenant=tenant,
        document_type=SignTask.DocumentType.ERECETE,
        title=f"e-Reçete — {patient.first_name} {patient.last_name}".strip(),
        description=f"{line_count} ilaç — {prescription.diagnosis_code}",
        status=SignTask.Status.PENDING,
        content_type=ct,
        object_id=prescription.id,
        metadata={
            "prescription_id": prescription.id,
            "prescription_no": prescription.prescription_no,
            "patient_id": patient.id,
            "patient_tckn": patient.tckn or "",
            "source": "prescriptions.prescription",
        },
    )
    return True


def sync_erecete_tasks(tenant: Tenant) -> int:
    ct = _prescription_ct()
    existing = _existing_source_ids(tenant, SignTask.DocumentType.ERECETE, ct)
    created = 0
    qs = (
        Prescription.all_tenants.filter(tenant=tenant, status=Prescription.Status.READY)
        .exclude(id__in=existing)
        .select_related("patient")
        .prefetch_related("lines")
    )
    for prescription in qs:
        if sync_sign_task_for_prescription(tenant, prescription):
            created += 1
    return created


def sync_tasks(tenant: Tenant, document_type: str | None = None) -> int:
    total = 0
    if document_type in (None, SignTask.DocumentType.EFATURA):
        total += sync_efatura_tasks(tenant)
    if document_type in (None, SignTask.DocumentType.EARSIV):
        total += sync_earsiv_tasks(tenant)
    if document_type in (None, SignTask.DocumentType.ERECETE):
        total += sync_erecete_tasks(tenant)
    return total
