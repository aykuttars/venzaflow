from __future__ import annotations

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType

from apps.billing.models import Invoice
from apps.billing.services.oral_invoice import resolve_e_document_type
from apps.oral.models import OralTreatment
from apps.signing.models import SignTask
from apps.tenants.models import Tenant


def _invoice_ct() -> ContentType:
    return ContentType.objects.get_for_model(Invoice)


def _oral_treatment_ct() -> ContentType:
    return ContentType.objects.get_for_model(OralTreatment)


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


def sync_erecete_tasks(tenant: Tenant) -> int:
    ct = _oral_treatment_ct()
    existing = _existing_source_ids(tenant, SignTask.DocumentType.ERECETE, ct)
    created = 0
    qs = (
        OralTreatment.objects.filter(
            tenant=tenant,
            status=OralTreatment.Status.COMPLETED,
            invoice__isnull=True,
        )
        .exclude(id__in=existing)
        .select_related("patient", "procedure")
    )
    for treatment in qs:
        patient = treatment.patient
        SignTask.objects.create(
            tenant=tenant,
            document_type=SignTask.DocumentType.ERECETE,
            title=f"e-Reçete — {treatment.procedure.name}",
            description=f"Hasta: {patient.first_name} {patient.last_name}".strip(),
            status=SignTask.Status.PENDING,
            content_type=ct,
            object_id=treatment.id,
            metadata={
                "treatment_id": treatment.id,
                "patient_id": patient.id,
                "source": "oral.treatment",
            },
        )
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
