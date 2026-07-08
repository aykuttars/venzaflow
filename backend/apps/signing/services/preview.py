from __future__ import annotations

from html import escape

from apps.billing.models import Invoice
from apps.billing.services.preview import DOCUMENT_TYPE_LABELS, render_invoice_preview_html
from apps.common.document_preview.html import render_html_page
from apps.common.document_preview.types import PreviewNotAvailable
from apps.prescriptions.models import Prescription
from apps.prescriptions.services.preview import render_prescription_preview_html
from apps.signing.models import SignTask


def render_sign_task_preview(task: SignTask) -> str:
    if task.content_type_id and task.object_id:
        model = task.content_type.model
        source = task.source
        if source is None:
            raise PreviewNotAvailable("Kaynak belge bulunamadı veya silinmiş.")

        if model == "prescription" and isinstance(source, Prescription):
            return render_prescription_preview_html(source)

        if model == "invoice" and isinstance(source, Invoice):
            label = DOCUMENT_TYPE_LABELS.get(task.document_type, task.get_document_type_display())
            return render_invoice_preview_html(source, document_type_label=label)

    return _render_manual_task_preview(task)


def _render_manual_task_preview(task: SignTask) -> str:
    metadata = task.metadata or {}
    meta_rows = "".join(
        f"<tr><td>{escape(str(key))}</td><td>{escape(str(value))}</td></tr>"
        for key, value in sorted(metadata.items())
    )
    meta_table = (
        f"<table><tbody>{meta_rows}</tbody></table>"
        if meta_rows
        else "<p class='muted'>Ek meta veri yok.</p>"
    )
    description = escape(task.description or "—")
    body = f"""
<div class="grid">
<div><strong>Belge tipi:</strong> {escape(task.get_document_type_display())}</div>
<div><strong>Durum:</strong> {escape(task.get_status_display())}</div>
</div>
<p><strong>Açıklama:</strong> {description}</p>
<h3 style="font-size:15px;margin:20px 0 8px">Meta veri</h3>
{meta_table}
<div class="footer"><p class="muted">Manuel imza görevi — bağlı kaynak belge yok.</p></div>
"""
    return render_html_page(
        title=task.title,
        subtitle=f"{task.get_document_type_display()} önizleme",
        body=body,
    )
