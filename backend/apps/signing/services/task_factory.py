from __future__ import annotations

from django.contrib.contenttypes.models import ContentType

from apps.billing.models import Invoice
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


def sync_efatura_tasks(tenant: Tenant) -> int:
    ct = _invoice_ct()
    existing = _existing_source_ids(tenant, SignTask.DocumentType.EFATURA, ct)
    created = 0
    qs = Invoice.objects.filter(tenant=tenant, status=Invoice.Status.DRAFT).exclude(id__in=existing)
    for invoice in qs.select_related("customer"):
        SignTask.objects.create(
            tenant=tenant,
            document_type=SignTask.DocumentType.EFATURA,
            title=f"e-Fatura — {invoice.number}",
            description=f"Müşteri: {invoice.customer.first_name} {invoice.customer.last_name}".strip(),
            status=SignTask.Status.PENDING,
            content_type=ct,
            object_id=invoice.id,
            metadata={"invoice_number": invoice.number, "source": "billing.invoice"},
        )
        created += 1
    return created


def sync_earsiv_tasks(tenant: Tenant) -> int:
    ct = _invoice_ct()
    existing = _existing_source_ids(tenant, SignTask.DocumentType.EARSIV, ct)
    created = 0
    qs = Invoice.objects.filter(tenant=tenant, status=Invoice.Status.SENT).exclude(id__in=existing)
    for invoice in qs.select_related("customer"):
        SignTask.objects.create(
            tenant=tenant,
            document_type=SignTask.DocumentType.EARSIV,
            title=f"e-Arşiv — {invoice.number}",
            description=f"Müşteri: {invoice.customer.first_name} {invoice.customer.last_name}".strip(),
            status=SignTask.Status.PENDING,
            content_type=ct,
            object_id=invoice.id,
            metadata={"invoice_number": invoice.number, "source": "billing.invoice"},
        )
        created += 1
    return created


def sync_erecete_tasks(tenant: Tenant) -> int:
    ct = _oral_treatment_ct()
    existing = _existing_source_ids(tenant, SignTask.DocumentType.ERECETE, ct)
    created = 0
    qs = (
        OralTreatment.objects.filter(tenant=tenant, status=OralTreatment.Status.COMPLETED)
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
