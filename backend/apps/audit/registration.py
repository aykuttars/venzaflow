"""Register models with django-auditlog."""

from __future__ import annotations

from auditlog.registry import auditlog

from apps.accounting.models import Account, Expense, Transaction
from apps.accounts.models import Department, User
from apps.appointments.models import Appointment, Schedule
from apps.billing.models import Invoice, InvoiceLine, Payment
from apps.customers.models import Customer, MedicalRecord
from apps.employees.models import Employee
from apps.inventory.models import Stock, StockMovement, Warehouse
from apps.products.models import Category, Product


def register_models() -> None:
    models = [
        Category,
        Product,
        Warehouse,
        Stock,
        StockMovement,
        Customer,
        MedicalRecord,
        Appointment,
        Schedule,
        Invoice,
        InvoiceLine,
        Payment,
        Account,
        Expense,
        Transaction,
        Employee,
        Department,
        User,
    ]
    for m in models:
        try:
            auditlog.register(m)
        except Exception:
            pass
