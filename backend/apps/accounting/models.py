from __future__ import annotations

from django.db import models

from apps.tenants.models import TenantOwnedModel


class Account(TenantOwnedModel):
    class Kind(models.TextChoices):
        ASSET = "asset", "Asset"
        LIABILITY = "liability", "Liability"
        EQUITY = "equity", "Equity"
        REVENUE = "revenue", "Revenue"
        EXPENSE = "expense", "Expense"

    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=Kind.choices)

    class Meta:
        unique_together = [("tenant", "code")]
        ordering = ["code"]


class Expense(TenantOwnedModel):
    account = models.ForeignKey(
        Account,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expenses",
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    incurred_on = models.DateField()

    class Meta:
        ordering = ["-incurred_on"]


class Transaction(TenantOwnedModel):
    class Kind(models.TextChoices):
        INCOME = "income", "Income"
        EXPENSE = "expense", "Expense"
        ADJUSTMENT = "adjustment", "Adjustment"

    kind = models.CharField(max_length=16, choices=Kind.choices)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    description = models.CharField(max_length=255, blank=True)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["-occurred_at"]
