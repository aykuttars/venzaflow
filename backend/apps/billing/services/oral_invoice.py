from __future__ import annotations

from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.billing.models import Invoice, InvoiceLine
from apps.customers.models import Customer
from apps.oral.models import OralTreatment
from apps.oral.services.procedure_product import ensure_procedure_product
from apps.tenants.models import Tenant


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def suggest_invoice_number(tenant: Tenant, issued_at: date | None = None) -> str:
    year = (issued_at or timezone.localdate()).year
    prefix = f"F{year}"
    last = (
        Invoice.all_tenants.filter(tenant=tenant, number__startswith=prefix)
        .order_by("-number")
        .values_list("number", flat=True)
        .first()
    )
    seq = 1
    if last and len(last) > len(prefix):
        try:
            seq = int(last[len(prefix) :]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def resolve_e_document_type(invoice: Invoice) -> str:
    if invoice.e_document_type == Invoice.EDocumentType.NONE:
        return "none"
    if invoice.e_document_type in (
        Invoice.EDocumentType.EFATURA,
        Invoice.EDocumentType.EARSIV,
    ):
        return invoice.e_document_type
    customer = invoice.customer
    if customer.kind == Customer.Kind.PATIENT or getattr(customer, "tckn", None):
        return Invoice.EDocumentType.EARSIV
    return Invoice.EDocumentType.EFATURA


def _treatment_line_description(treatment: OralTreatment) -> str:
    teeth = ", ".join(str(t) for t in (treatment.tooth_numbers or []))
    name = treatment.procedure.name
    if teeth:
        return f"Diş {teeth} — {name}"
    return name


def _line_gross(qty: int, unit_price: Decimal) -> Decimal:
    return _quantize(Decimal(qty) * Decimal(unit_price))


def compute_invoice_totals(
    lines: list[dict],
    discount_percent: Decimal = Decimal("0"),
) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    subtotal = Decimal("0")
    for line in lines:
        gross = _line_gross(line["quantity"], line["unit_price"])
        line_disc_pct = Decimal(str(line.get("discount_percent") or 0))
        line_disc_amt = Decimal(str(line.get("line_discount_amount") or 0))
        if line_disc_pct > 0:
            gross -= _quantize(gross * line_disc_pct / Decimal("100"))
        elif line_disc_amt > 0:
            gross -= _quantize(line_disc_amt)
        subtotal += _quantize(gross)

    disc_pct = Decimal(str(discount_percent or 0))
    discount_amount = _quantize(subtotal * disc_pct / Decimal("100")) if disc_pct > 0 else Decimal("0")
    total = _quantize(subtotal - discount_amount)
    return _quantize(subtotal), discount_amount, total, disc_pct


@transaction.atomic
def create_invoice_from_treatments(
    tenant: Tenant,
    patient: Customer,
    treatment_ids: list[int],
    *,
    discount_percent: Decimal | float = 0,
    issued_at: date | None = None,
    e_document_type: str = Invoice.EDocumentType.AUTO,
    notes: str = "",
    number: str | None = None,
) -> Invoice:
    if patient.kind != Customer.Kind.PATIENT:
        raise ValidationError({"patient": "Customer must be a patient."})
    if not treatment_ids:
        raise ValidationError({"treatment_ids": "At least one treatment is required."})

    treatments = list(
        OralTreatment.all_tenants.select_related("procedure", "procedure__product")
        .filter(tenant=tenant, pk__in=treatment_ids)
        .order_by("session_date", "id")
    )
    if len(treatments) != len(set(treatment_ids)):
        raise ValidationError({"treatment_ids": "One or more treatments were not found."})

    for t in treatments:
        if t.patient_id != patient.id:
            raise ValidationError({"treatment_ids": "All treatments must belong to the same patient."})
        if t.status != OralTreatment.Status.COMPLETED:
            raise ValidationError({"treatment_ids": f"Treatment {t.id} is not completed."})
        if t.invoice_id:
            raise ValidationError({"treatment_ids": f"Treatment {t.id} is already invoiced."})

    issue_date = issued_at or timezone.localdate()
    inv_number = number or suggest_invoice_number(tenant, issue_date)
    if Invoice.all_tenants.filter(tenant=tenant, number=inv_number).exists():
        raise ValidationError({"number": "Invoice number already exists."})

    line_payloads: list[dict] = []
    for t in treatments:
        product = t.procedure.product
        if not product:
            product = ensure_procedure_product(t.procedure)
        gross = _line_gross(1, t.unit_price)
        line_payloads.append(
            {
                "quantity": 1,
                "unit_price": t.unit_price,
                "discount_percent": Decimal("0"),
                "line_discount_amount": Decimal("0"),
                "line_total": gross,
                "product": product,
                "description": _treatment_line_description(t),
                "treatment": t,
            }
        )

    subtotal, discount_amount, total, disc_pct = compute_invoice_totals(
        line_payloads, discount_percent=Decimal(str(discount_percent))
    )

    invoice = Invoice.all_tenants.create(
        tenant=tenant,
        number=inv_number,
        customer=patient,
        issued_at=issue_date,
        status=Invoice.Status.DRAFT,
        subtotal_before_discount=subtotal,
        discount_percent=disc_pct,
        discount_amount=discount_amount,
        total=total,
        notes=notes or "",
        e_document_type=e_document_type,
    )

    now = timezone.now()
    for payload in line_payloads:
        InvoiceLine.all_tenants.create(
            tenant=tenant,
            invoice=invoice,
            product=payload["product"],
            description=payload["description"],
            oral_treatment=payload["treatment"],
            quantity=payload["quantity"],
            unit_price=payload["unit_price"],
            discount_percent=payload["discount_percent"],
            line_discount_amount=payload["line_discount_amount"],
            line_total=payload["line_total"],
        )
        treatment = payload["treatment"]
        treatment.invoice = invoice
        treatment.invoiced_at = now
        treatment.save(update_fields=["invoice", "invoiced_at"])

    from apps.tenants.subscription_service import tenant_has_module

    if tenant_has_module(tenant, "signing"):
        from apps.signing.services.task_factory import sync_sign_task_for_invoice

        sync_sign_task_for_invoice(tenant, invoice)

    return invoice
