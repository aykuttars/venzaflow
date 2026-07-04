from __future__ import annotations

from django.utils import timezone

from apps.service.models import ServiceTicket


def allocate_ticket_number(tenant_id: int) -> str:
    year = timezone.localdate().year
    prefix = f"SR-{year}-"
    last = (
        ServiceTicket.all_tenants.filter(
            tenant_id=tenant_id,
            ticket_number__startswith=prefix,
        )
        .order_by("-ticket_number")
        .values_list("ticket_number", flat=True)
        .first()
    )
    seq = 1
    if last:
        try:
            seq = int(last.rsplit("-", 1)[-1]) + 1
        except (TypeError, ValueError):
            seq = 1
    return f"{prefix}{seq:04d}"
