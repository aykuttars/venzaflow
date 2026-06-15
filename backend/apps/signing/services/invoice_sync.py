from __future__ import annotations

from apps.billing.models import Invoice
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
