from __future__ import annotations

from apps.customers.models import Customer
from apps.oral.models import OralTreatment, PatientOralChart, ProcedureCatalog


PROCEDURE_CONDITION_MAP = {
    "dolgu": "filled",
    "kanal": "root_canal",
    "implant": "implant",
    "çekim": "missing",
    "cekim": "missing",
    "kron": "crown",
    "köprü": "bridge",
    "kopru": "bridge",
}


def condition_for_procedure(procedure: ProcedureCatalog) -> str:
    if procedure.default_tooth_condition:
        return procedure.default_tooth_condition
    name_lower = procedure.name.lower()
    for key, condition in PROCEDURE_CONDITION_MAP.items():
        if key in name_lower:
            return condition
    if procedure.category == ProcedureCatalog.Category.DIAGNOSIS:
        return "caries"
    return "filled"


def sync_chart_from_treatment(treatment: OralTreatment) -> None:
    if treatment.status != OralTreatment.Status.COMPLETED:
        return
    patient = treatment.patient
    if patient.kind != Customer.Kind.PATIENT:
        return

    chart, _ = PatientOralChart.objects.get_or_create(
        tenant_id=treatment.tenant_id,
        patient=patient,
        defaults={"teeth_state": {}},
    )
    condition = condition_for_procedure(treatment.procedure)
    state = dict(chart.teeth_state or {})
    for tooth in treatment.tooth_numbers or []:
        key = str(tooth)
        entry = dict(state.get(key) or {})
        entry["condition"] = condition
        if treatment.notes:
            entry["notes"] = treatment.notes
        state[key] = entry
    chart.teeth_state = state
    chart.save(update_fields=["teeth_state"])
