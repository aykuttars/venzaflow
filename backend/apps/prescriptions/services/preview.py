from __future__ import annotations

from html import escape

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
    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>Reçete {escape(prescription.prescription_no or str(prescription.pk))}</title>
<style>
body {{ font-family: Georgia, serif; max-width: 720px; margin: 24px auto; color: #111; }}
.header {{ border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }}
.grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 14px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 14px; }}
th, td {{ border: 1px solid #333; padding: 8px; text-align: left; vertical-align: top; }}
th {{ background: #f5f5f5; }}
.footer {{ margin-top: 32px; font-size: 13px; }}
</style>
</head>
<body>
<div class="header">
<h1 style="margin:0;font-size:20px">REÇETE</h1>
<p style="margin:4px 0 0">SGK e-Reçete önizleme — {escape(prescription.get_prescription_type_display())}</p>
</div>
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
</div>
</body>
</html>"""
