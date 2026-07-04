from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.utils import timezone

from apps.service.models import PaymentMethod, ServiceTicket, ServiceTicketEvent, ServiceTicketStatus


class TransitionError(Exception):
    pass


ALLOWED: dict[str, set[str]] = {
    ServiceTicketStatus.RECEIVED: {
        ServiceTicketStatus.DIAGNOSING,
        ServiceTicketStatus.CANCELLED,
    },
    ServiceTicketStatus.DIAGNOSING: {
        ServiceTicketStatus.AWAITING_APPROVAL,
        ServiceTicketStatus.CANCELLED,
    },
    ServiceTicketStatus.AWAITING_APPROVAL: {
        ServiceTicketStatus.IN_REPAIR,
        ServiceTicketStatus.CANCELLED,
    },
    ServiceTicketStatus.IN_REPAIR: {
        ServiceTicketStatus.READY,
        ServiceTicketStatus.CANCELLED,
    },
    ServiceTicketStatus.READY: {
        ServiceTicketStatus.DELIVERED,
    },
}


@dataclass
class TransitionResult:
    ticket: ServiceTicket
    event: ServiceTicketEvent


def _record_event(
    ticket: ServiceTicket,
    *,
    from_status: str,
    to_status: str,
    note: str,
    user,
) -> ServiceTicketEvent:
    return ServiceTicketEvent.objects.create(
        tenant_id=ticket.tenant_id,
        ticket=ticket,
        from_status=from_status,
        to_status=to_status,
        note=note or "",
        created_by=user if user and user.is_authenticated else None,
    )


def transition_ticket(
    ticket: ServiceTicket,
    *,
    to_status: str,
    note: str = "",
    user=None,
) -> TransitionResult:
    current = ticket.status
    allowed = ALLOWED.get(current, set())
    if to_status not in allowed:
        raise TransitionError(f"Cannot move from {current} to {to_status}.")

    now = timezone.now()
    ticket.status = to_status
    update_fields = ["status", "updated_at"]

    if to_status == ServiceTicketStatus.DIAGNOSING and not ticket.diagnosed_at:
        ticket.diagnosed_at = now
        update_fields.append("diagnosed_at")
    elif to_status == ServiceTicketStatus.IN_REPAIR:
        ticket.approved_at = now
        update_fields.append("approved_at")
    elif to_status == ServiceTicketStatus.READY:
        ticket.completed_at = now
        update_fields.append("completed_at")

    ticket.save(update_fields=update_fields)
    event = _record_event(ticket, from_status=current, to_status=to_status, note=note, user=user)
    return TransitionResult(ticket=ticket, event=event)


def approve_quote(ticket: ServiceTicket, *, note: str = "", user=None) -> TransitionResult:
    if ticket.status != ServiceTicketStatus.AWAITING_APPROVAL:
        raise TransitionError("Ticket is not awaiting approval.")
    return transition_ticket(
        ticket, to_status=ServiceTicketStatus.IN_REPAIR, note=note or "Customer approved", user=user
    )


def deliver_ticket(
    ticket: ServiceTicket,
    *,
    final_price: Decimal,
    payment_method: str,
    note: str = "",
    user=None,
) -> TransitionResult:
    if ticket.status != ServiceTicketStatus.READY:
        raise TransitionError("Ticket is not ready for delivery.")
    if payment_method not in dict(PaymentMethod.choices):
        raise TransitionError("Invalid payment method.")

    now = timezone.now()
    from_status = ticket.status
    ticket.status = ServiceTicketStatus.DELIVERED
    ticket.final_price = final_price
    ticket.payment_method = payment_method
    ticket.payment_received_at = now
    ticket.delivered_at = now
    ticket.save(
        update_fields=[
            "status",
            "final_price",
            "payment_method",
            "payment_received_at",
            "delivered_at",
            "updated_at",
        ]
    )
    event = _record_event(
        ticket,
        from_status=from_status,
        to_status=ServiceTicketStatus.DELIVERED,
        note=note or f"Paid {final_price} via {payment_method}",
        user=user,
    )
    return TransitionResult(ticket=ticket, event=event)


def ticket_snapshot(ticket: ServiceTicket, *, copy_label: str = "") -> dict:
    received = timezone.localtime(ticket.received_at) if ticket.received_at else timezone.localtime()
    complaint = (ticket.complaint or "").strip()
    if len(complaint) > 80:
        complaint = complaint[:77] + "..."
    return {
        "number": ticket.ticket_number,
        "customer_name": ticket.customer_name,
        "customer_phone": ticket.customer_phone,
        "device": ticket.device_summary,
        "device_brand": ticket.device_brand,
        "device_model": ticket.device_model,
        "device_serial": ticket.device_serial,
        "complaint": ticket.complaint,
        "complaint_short": complaint,
        "received_date": received.strftime("%d.%m.%Y"),
        "received_datetime": received.strftime("%d.%m.%Y %H:%M"),
        "copy_label": copy_label,
        "qr": ticket.ticket_number,
    }
