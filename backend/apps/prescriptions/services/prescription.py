from __future__ import annotations

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.prescriptions.models import Prescription
from apps.signing.services.task_factory import sync_sign_task_for_prescription
from apps.tenants.models import Tenant


def suggest_prescription_no(tenant: Tenant) -> str:
    year = timezone.localdate().year
    prefix = f"RX{year}"
    last = (
        Prescription.all_tenants.filter(tenant=tenant, prescription_no__startswith=prefix)
        .order_by("-prescription_no")
        .values_list("prescription_no", flat=True)
        .first()
    )
    seq = 1
    if last and len(last) > len(prefix):
        try:
            seq = int(last[len(prefix) :]) + 1
        except ValueError:
            seq = 1
    return f"{prefix}{seq:04d}"


def validate_prescription_for_finalize(prescription: Prescription) -> None:
    if prescription.status != Prescription.Status.DRAFT:
        raise ValidationError({"status": "Only draft prescriptions can be finalized."})
    patient = prescription.patient
    if not (patient.tckn or "").strip():
        raise ValidationError({"patient": "Patient TCKN is required for e-Reçete."})
    if not prescription.doctor_id:
        raise ValidationError({"doctor": "Prescribing doctor is required."})
    if not (prescription.diagnosis_code or "").strip():
        raise ValidationError({"diagnosis_code": "Diagnosis code (ICD-10) is required."})
    lines = list(prescription.lines.all())
    if not lines:
        raise ValidationError({"lines": "At least one drug line is required."})
    for idx, line in enumerate(lines, start=1):
        if not (line.drug_name or "").strip():
            raise ValidationError({"lines": f"Line {idx}: drug name is required."})
        if not (line.dose or "").strip():
            raise ValidationError({"lines": f"Line {idx}: dose is required."})
        if not (line.frequency or "").strip():
            raise ValidationError({"lines": f"Line {idx}: frequency is required."})
        if not (line.usage_instruction or "").strip():
            raise ValidationError({"lines": f"Line {idx}: usage instruction is required."})


@transaction.atomic
def finalize_prescription(prescription: Prescription, *, actor) -> Prescription:
    validate_prescription_for_finalize(prescription)
    if not prescription.prescription_no:
        prescription.prescription_no = suggest_prescription_no(prescription.tenant)
    if not prescription.doctor_id:
        prescription.doctor = actor
    prescription.status = Prescription.Status.READY
    prescription.finalized_at = timezone.now()
    prescription.save(
        update_fields=[
            "prescription_no",
            "doctor",
            "status",
            "finalized_at",
        ]
    )
    from apps.tenants.subscription_service import tenant_has_module

    if tenant_has_module(prescription.tenant, "signing"):
        sync_sign_task_for_prescription(prescription.tenant, prescription)
    return prescription


@transaction.atomic
def cancel_prescription(prescription: Prescription) -> Prescription:
    if prescription.status not in (Prescription.Status.DRAFT, Prescription.Status.READY):
        raise ValidationError({"status": "Only draft or ready prescriptions can be cancelled."})
    prescription.status = Prescription.Status.CANCELLED
    prescription.save(update_fields=["status"])
    return prescription
