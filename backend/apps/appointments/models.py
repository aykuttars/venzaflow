from __future__ import annotations

from django.db import models

from apps.customers.models import Customer
from apps.tenants.models import TenantOwnedModel


class Schedule(TenantOwnedModel):
    name = models.CharField(max_length=128)
    resource = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["name"]


class Appointment(TenantOwnedModel):
    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name="appointments")
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["start_at"]
