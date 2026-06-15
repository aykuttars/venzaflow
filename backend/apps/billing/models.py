from __future__ import annotations

from django.db import models

from apps.customers.models import Customer
from apps.products.models import Product
from apps.tenants.models import TenantOwnedModel


class Invoice(TenantOwnedModel):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        PAID = "paid", "Paid"
        OVERDUE = "overdue", "Overdue"

    class EDocumentType(models.TextChoices):
        AUTO = "auto", "Auto"
        EFATURA = "efatura", "e-Fatura"
        EARSIV = "earsiv", "e-Arşiv"
        NONE = "none", "None"

    number = models.CharField(max_length=64)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="invoices")
    issued_at = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    subtotal_before_discount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    e_document_type = models.CharField(
        max_length=16,
        choices=EDocumentType.choices,
        default=EDocumentType.AUTO,
    )

    class Meta:
        db_table = "invoice"
        unique_together = [("tenant", "number")]
        ordering = ["-issued_at"]

    def __str__(self) -> str:
        return self.number


class InvoiceLine(TenantOwnedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    description = models.CharField(max_length=512, blank=True)
    oral_treatment = models.ForeignKey(
        "oral.OralTreatment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="invoice_lines",
    )
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    line_discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    line_total = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = "invoice_line"
        ordering = ["id"]


class Payment(TenantOwnedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.PROTECT, related_name="payments")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    paid_at = models.DateTimeField()
    method = models.CharField(max_length=64, default="cash")

    class Meta:
        db_table = "payment"
        ordering = ["-paid_at"]
