from __future__ import annotations

import re

from apps.service.models import ServiceTicket


def lookup_service_tickets(tenant_id: int, q: str, *, limit: int = 20) -> list[ServiceTicket]:
    """Find service tickets by number, phone, or customer name (partial / multi-word)."""
    text = (q or "").strip()
    if not text:
        return []

    qs = ServiceTicket.objects.filter(tenant_id=tenant_id).order_by("-received_at")

    exact = qs.filter(ticket_number__iexact=text).first()
    if exact:
        return [exact]

    if text.isdigit():
        by_id = qs.filter(pk=int(text)).first()
        if by_id:
            return [by_id]

    phone_digits = re.sub(r"\D", "", text)
    if len(phone_digits) >= 4:
        phone_matches = list(qs.filter(customer_phone__icontains=phone_digits)[:limit])
        if phone_matches:
            return phone_matches

    tokens = [part for part in re.split(r"\s+", text) if part]
    if tokens:
        name_qs = qs
        for token in tokens:
            name_qs = name_qs.filter(customer_name__icontains=token)
        name_matches = list(name_qs[:limit])
        if name_matches:
            return name_matches

    return list(qs.filter(customer_name__icontains=text)[:limit])
