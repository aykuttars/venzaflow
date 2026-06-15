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


def build_prescription_payload(task: SignTask) -> bytes:
    prescription = task.source
    if prescription is None:
        raise ValueError("Sign task has no linked prescription source.")

    patient = prescription.patient
    doctor = prescription.doctor
    lines = []
    for line in prescription.lines.select_related("drug").all():
        lines.append(
            {
                "barkod": line.drug_barkod or (line.drug.barkod if line.drug_id else ""),
                "name": line.drug_name,
                "box_count": line.box_count,
                "quantity_per_box": line.quantity_per_box,
                "dose": line.dose,
                "frequency": line.frequency,
                "period_days": line.period_days,
                "route": line.route,
                "usage_instruction": line.usage_instruction,
            }
        )
    payload = {
        "document_type": task.document_type,
        "prescription_id": prescription.id,
        "prescription_no": prescription.prescription_no,
        "prescription_type": prescription.prescription_type,
        "provision_type": prescription.provision_type,
        "diagnosis_code": prescription.diagnosis_code,
        "diagnosis_text": prescription.diagnosis_text,
        "patient": {
            "id": patient.id,
            "tckn": patient.tckn or "",
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "birth_date": patient.birth_date.isoformat() if patient.birth_date else None,
        },
        "doctor": {
            "id": doctor.id if doctor else None,
            "email": getattr(doctor, "email", "") if doctor else "",
            "name": (
                f"{getattr(doctor, 'first_name', '')} {getattr(doctor, 'last_name', '')}".strip()
                if doctor
                else ""
            ),
        },
        "lines": lines,
        "notes": prescription.notes,
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
    if model_name == "prescription":
        return build_prescription_payload(task)
    if model_name == "oraltreatment":
        return build_oral_treatment_payload(task)

    return build_manual_payload(task)


def payload_digest(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()
