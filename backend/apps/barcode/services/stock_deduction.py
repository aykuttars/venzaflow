from __future__ import annotations

from django.db import transaction

from apps.barcode.models import StockDeductionMode
from apps.barcode.services.settings import get_or_create_settings
from apps.billing.models import Invoice
from apps.inventory.models import MovementType, Stock, StockMovement, Warehouse
from apps.inventory.services.movement import MovementInput, MovementService, MovementServiceError


def _should_deduct_on_invoice(tenant_id: int) -> bool:
    settings = get_or_create_settings(tenant_id)
    flags = settings.operation_flags or {}
    if not flags.get("sales_stock_deduction", False):
        return False
    mode = settings.stock_deduction_mode
    return mode in (StockDeductionMode.ON_INVOICE, StockDeductionMode.BOTH)


def _should_deduct_manual(tenant_id: int) -> bool:
    settings = get_or_create_settings(tenant_id)
    flags = settings.operation_flags or {}
    if not flags.get("sales_stock_deduction", False):
        return False
    mode = settings.stock_deduction_mode
    return mode in (StockDeductionMode.ON_MANUAL_CONFIRM, StockDeductionMode.BOTH)


@transaction.atomic
def deduct_stock_for_invoice(invoice: Invoice, *, created_by=None) -> list[dict]:
    if not _should_deduct_on_invoice(invoice.tenant_id):
        return []
    if invoice.status != Invoice.Status.PAID:
        return []

    warehouse = Warehouse.objects.filter(
        tenant_id=invoice.tenant_id, code="MAGAZA", is_active=True
    ).first()
    if not warehouse:
        return []

    ref = f"invoice:{invoice.pk}"
    results: list[dict] = []
    for line in invoice.lines.select_related("product"):
        if StockMovement.objects.filter(
            tenant_id=invoice.tenant_id,
            reference=ref,
            product_id=line.product_id,
        ).exists():
            continue
        stock = Stock.objects.filter(
            tenant_id=invoice.tenant_id,
            product_id=line.product_id,
            warehouse=warehouse,
        ).first()
        if not stock:
            results.append(
                {"product_id": line.product_id, "error": "No MAGAZA stock row."}
            )
            continue
        try:
            MovementService.apply_movement(
                MovementInput(
                    stock=stock,
                    movement_type=MovementType.SALE.value,
                    quantity=int(line.quantity),
                    note=f"Invoice {invoice.number}",
                    reference=ref,
                    reference_type="invoice",
                    reference_id=str(invoice.pk),
                    created_by=created_by,
                    tenant_id=invoice.tenant_id,
                )
            )
            results.append({"product_id": line.product_id, "quantity": line.quantity})
        except MovementServiceError as exc:
            results.append({"product_id": line.product_id, "error": str(exc)})
    return results


@transaction.atomic
def manual_stock_deduction(
    *,
    tenant_id: int,
    product_id: int,
    quantity: int,
    warehouse_code: str = "MAGAZA",
    note: str = "",
    created_by=None,
) -> dict:
    if not _should_deduct_manual(tenant_id):
        return {"error": "Manual stock deduction is disabled for this tenant."}

    warehouse = Warehouse.objects.filter(
        tenant_id=tenant_id, code=warehouse_code, is_active=True
    ).first()
    if not warehouse:
        return {"error": "Warehouse not found."}

    stock = Stock.objects.filter(
        tenant_id=tenant_id, product_id=product_id, warehouse=warehouse
    ).first()
    if not stock:
        return {"error": "Stock row not found."}

    movement = MovementService.apply_movement(
        MovementInput(
            stock=stock,
            movement_type=MovementType.SALE.value,
            quantity=quantity,
            note=note or "Manual sale confirm",
            reference_type="manual_confirm",
            created_by=created_by,
            tenant_id=tenant_id,
        )
    )
    return {"movement_id": movement.pk, "new_quantity": movement.new_quantity}
