from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.customers.models import Customer
from apps.tenants.models import TenantOwnedModel


class ServiceTicketStatus(models.TextChoices):
    RECEIVED = "received", "Received"
    DIAGNOSING = "diagnosing", "Diagnosing"
    AWAITING_APPROVAL = "awaiting_approval", "Awaiting approval"
    IN_REPAIR = "in_repair", "In repair"
    READY = "ready", "Ready for pickup"
    DELIVERED = "delivered", "Delivered"
    CANCELLED = "cancelled", "Cancelled"


class PaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    CARD = "card", "Card"
    IBAN = "iban", "Bank transfer"


class ServiceTicket(TenantOwnedModel):
    ticket_number = models.CharField(max_length=32, db_index=True)
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_tickets",
    )
    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32, blank=True)
    device_brand = models.CharField(max_length=128, blank=True)
    device_model = models.CharField(max_length=128, blank=True)
    device_serial = models.CharField(max_length=128, blank=True)
    complaint = models.TextField()
    diagnosis = models.TextField(blank=True)
    estimated_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    final_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    payment_method = models.CharField(
        max_length=16,
        choices=PaymentMethod.choices,
        blank=True,
    )
    payment_received_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=ServiceTicketStatus.choices,
        default=ServiceTicketStatus.RECEIVED,
        db_index=True,
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_service_tickets",
    )
    received_at = models.DateTimeField(auto_now_add=True)
    diagnosed_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    invoice = models.ForeignKey(
        "billing.Invoice",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_tickets",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "service_ticket"
        ordering = ["-received_at"]
        indexes = [
            models.Index(fields=["tenant", "status"]),
            models.Index(fields=["tenant", "ticket_number"]),
            models.Index(fields=["tenant", "customer_phone"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "ticket_number"],
                name="service_ticket_unique_number",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.ticket_number} — {self.customer_name}"

    @property
    def device_summary(self) -> str:
        parts = [p for p in (self.device_brand, self.device_model) if p]
        return " ".join(parts) or "—"


class ServiceTicketEvent(TenantOwnedModel):
    ticket = models.ForeignKey(
        ServiceTicket,
        on_delete=models.CASCADE,
        related_name="events",
    )
    from_status = models.CharField(max_length=32, blank=True)
    to_status = models.CharField(max_length=32)
    note = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="service_ticket_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "service_ticket_event"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.ticket_id}: {self.from_status} → {self.to_status}"
