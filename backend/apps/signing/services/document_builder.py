from __future__ import annotations

import hashlib
import json
from typing import Any

from apps.signing.models import SignTask


def _canonical_json(data: dict[str, Any]) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def build_invoice_payload(task: SignTask) -> bytes:
    invoice = task.source
    if invoice is None:
        raise ValueError("Sign task has no linked invoice source.")

    lines = []
    for line in invoice.lines.all():
        lines.append(
            {
                "product_id": line.product_id,
                "quantity": str(line.quantity),
                "unit_price": str(line.unit_price),
                "line_total": str(line.line_total),
            }
        )

    payload = {
        "document_type": task.document_type,
        "invoice_id": invoice.id,
        "number": invoice.number,
        "customer_id": invoice.customer_id,
        "issued_at": invoice.issued_at.isoformat(),
        "due_date": invoice.due_date.isoformat() if invoice.due_date else None,
        "status": invoice.status,
        "total": str(invoice.total),
        "lines": lines,
    }
    return _canonical_json(payload)


def build_oral_treatment_payload(task: SignTask) -> bytes:
    treatment = task.source
    if treatment is None:
        raise ValueError("Sign task has no linked oral treatment source.")

    payload = {
        "document_type": task.document_type,
        "treatment_id": treatment.id,
        "patient_id": treatment.patient_id,
        "procedure_id": treatment.procedure_id,
        "procedure_name": treatment.procedure.name,
        "tooth_numbers": treatment.tooth_numbers,
        "status": treatment.status,
        "session_date": treatment.session_date.isoformat() if treatment.session_date else None,
        "doctor_id": treatment.doctor_id,
        "unit_price": str(treatment.unit_price),
        "notes": treatment.notes,
    }
    return _canonical_json(payload)


def build_manual_payload(task: SignTask) -> bytes:
    payload = {
        "document_type": task.document_type,
        "task_id": task.id,
        "title": task.title,
        "description": task.description,
        "metadata": task.metadata or {},
    }
    return _canonical_json(payload)


def build_payload(task: SignTask) -> bytes:
    if task.content_type is None or task.object_id is None:
        return build_manual_payload(task)

    model_name = task.content_type.model
    if model_name == "invoice":
        return build_invoice_payload(task)
    if model_name == "oraltreatment":
        return build_oral_treatment_payload(task)

    return build_manual_payload(task)


def payload_digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()
