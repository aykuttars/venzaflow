from __future__ import annotations

from django.conf import settings
from django.db import models

from apps.tenants.models import TenantOwnedModel


class Employee(TenantOwnedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_profile",
    )
    employee_no = models.CharField(max_length=64)
    hire_date = models.DateField()
    salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = [("tenant", "employee_no")]
        ordering = ["employee_no"]

    def __str__(self) -> str:
        return f"{self.employee_no} ({self.user.email})"
