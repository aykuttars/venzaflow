from __future__ import annotations

from apps.billing.models import Invoice
from apps.prescriptions.models import Prescription
from apps.signing.models import SignTask


def mark_linked_invoice_sent(task: SignTask) -> None:
    """Move a draft invoice to sent after successful e-document submission."""
    if not task.content_type or task.content_type.model != "invoice" or not task.object_id:
        return
    Invoice.all_tenants.filter(
        pk=task.object_id,
        tenant=task.tenant,
        status=Invoice.Status.DRAFT,
    ).update(status=Invoice.Status.SENT)


def mark_linked_prescription_submitted(task: SignTask) -> None:
    if not task.content_type or task.content_type.model != "prescription" or not task.object_id:
        return
    from django.utils import timezone

    Prescription.all_tenants.filter(
        pk=task.object_id,
        tenant=task.tenant,
        status=Prescription.Status.READY,
    ).update(
        status=Prescription.Status.SUBMITTED,
        medula_reference=task.external_reference or "",
        submitted_at=timezone.now(),
    )
