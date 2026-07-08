from __future__ import annotations

from html import escape

from apps.common.document_preview.html import render_html_page
from apps.prescriptions.models import Prescription


def render_prescription_preview_html(prescription: Prescription) -> str:
    patient = prescription.patient
    doctor = prescription.doctor
    lines = prescription.lines.select_related("drug").all()
    patient_name = escape(f"{patient.first_name} {patient.last_name}".strip())
    doctor_name = escape(
        f"{getattr(doctor, 'first_name', '')} {getattr(doctor, 'last_name', '')}".strip()
        or getattr(doctor, "email", "—")
        if doctor
        else "—"
    )
    rows = []
    for line in lines:
        usage = escape(
            " — ".join(
                p
                for p in (
                    line.dose,
                    line.frequency,
                    f"{line.period_days} gün" if line.period_days else "",
                    line.get_route_display(),
                    line.usage_instruction,
                )
                if p
            )
        )
        rows.append(
            f"<tr><td>{escape(line.drug_name)}</td>"
            f"<td>{line.box_count}</td><td>{usage}</td></tr>"
        )
    line_rows = "\n".join(rows) or "<tr><td colspan='3'>—</td></tr>"
    body = f"""
<div class="grid">
<div><strong>Hasta:</strong> {patient_name}</div>
<div><strong>TCKN:</strong> {escape(patient.tckn or "—")}</div>
<div><strong>Tanı:</strong> {escape(prescription.diagnosis_code)} — {escape(prescription.diagnosis_text)}</div>
<div><strong>Provizyon:</strong> {escape(prescription.get_provision_type_display())}</div>
<div><strong>Hekim:</strong> {doctor_name}</div>
<div><strong>Reçete No:</strong> {escape(prescription.prescription_no or "—")}</div>
</div>
<table>
<thead><tr><th>İlaç</th><th>Kutu</th><th>Kullanım</th></tr></thead>
<tbody>
{line_rows}
</tbody>
</table>
<div class="footer">
<p>{escape(prescription.notes or "")}</p>
<p>Durum: {escape(prescription.get_status_display())}</p>
<p class="muted">Önizleme — resmi e-reçete imza öncesi bilgilendirme amaçlıdır.</p>
</div>
"""
    return render_html_page(
        title="REÇETE",
        subtitle=f"SGK e-Reçete önizleme — {prescription.get_prescription_type_display()}",
        body=body,
    )
