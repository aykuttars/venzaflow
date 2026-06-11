from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.db import transaction

from apps.inventory.models import (
    INBOUND_MOVEMENT_TYPES,
    OUTBOUND_MOVEMENT_TYPES,
    MovementType,
    Stock,
    StockMovement,
)


class MovementServiceError(Exception):
    pass


@dataclass
class MovementInput:
    stock: Stock
    movement_type: str
    quantity: int | None = None
    delta: int | None = None
    note: str = ""
    reason: str = ""
    reference: str = ""
    reference_type: str = ""
    reference_id: str = ""
    created_by: Any = None
    tenant_id: int | None = None


def _signed_delta(movement_type: str, quantity: int) -> int:
    qty = abs(int(quantity))
    if movement_type in INBOUND_MOVEMENT_TYPES:
        return qty
    if movement_type in OUTBOUND_MOVEMENT_TYPES:
        return -qty
    if movement_type == MovementType.ADJUSTMENT.value:
        return qty
    return qty


def _delta_from_payload(movement_type: str, quantity: int | None, delta: int | None) -> int:
    if delta is not None:
        return int(delta)
    if quantity is not None:
        return _signed_delta(movement_type, int(quantity))
    raise MovementServiceError("quantity or delta is required")


class MovementService:
    @staticmethod
    @transaction.atomic
    def apply_movement(data: MovementInput) -> StockMovement:
        # Lock stock row only; nullable location FK must not be outer-joined with FOR UPDATE.
        stock = (
            Stock.objects.select_for_update(of=("self",))
            .select_related("product", "warehouse")
            .get(pk=data.stock.pk)
        )
        movement_type = data.movement_type or MovementType.ADJUSTMENT.value
        if isinstance(movement_type, MovementType):
            movement_type = movement_type.value
        signed_delta = _delta_from_payload(movement_type, data.quantity, data.delta)
        abs_qty = abs(signed_delta)

        previous = stock.quantity
        new_qty = previous + signed_delta
        if new_qty < 0:
            raise MovementServiceError("Insufficient stock for this movement")

        stock.quantity = new_qty
        stock.save(update_fields=["quantity", "updated_at"])

        note = data.note or data.reason
        movement = StockMovement.objects.create(
            tenant_id=data.tenant_id or stock.tenant_id,
            stock=stock,
            product=stock.product,
            warehouse=stock.warehouse,
            location=stock.location,
            movement_type=movement_type,
            quantity=abs_qty,
            delta=signed_delta,
            previous_quantity=previous,
            new_quantity=new_qty,
            reason=data.reason or note[:255] if note else "",
            note=note,
            reference=data.reference,
            reference_type=data.reference_type,
            reference_id=data.reference_id,
            created_by=data.created_by,
        )
        return movement

    @staticmethod
    @transaction.atomic
    def transfer(
        *,
        source_stock: Stock,
        target_stock: Stock,
        quantity: int,
        note: str = "",
        created_by: Any = None,
        tenant_id: int | None = None,
    ) -> tuple[StockMovement, StockMovement]:
        qty = abs(int(quantity))
        if qty <= 0:
            raise MovementServiceError("Transfer quantity must be positive")
        tid = tenant_id or source_stock.tenant_id
        out_mv = MovementService.apply_movement(
            MovementInput(
                stock=source_stock,
                movement_type=MovementType.TRANSFER_OUT.value,
                quantity=qty,
                note=note,
                created_by=created_by,
                tenant_id=tid,
            )
        )
        in_mv = MovementService.apply_movement(
            MovementInput(
                stock=target_stock,
                movement_type=MovementType.TRANSFER_IN.value,
                quantity=qty,
                note=note,
                reference_type="transfer",
                reference_id=str(out_mv.pk),
                created_by=created_by,
                tenant_id=tid,
            )
        )
        return out_mv, in_mv
