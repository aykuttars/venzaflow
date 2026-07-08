from __future__ import annotations

from decimal import Decimal
from html import escape

from apps.billing.models import Invoice
from apps.common.document_preview.html import render_html_page

DOCUMENT_TYPE_LABELS = {
    "efatura": "e-Fatura",
    "earsiv": "e-Arşiv",
    "invoice": "Fatura",
}


def _money(value: Decimal | int | float | str) -> str:
    try:
        amount = Decimal(str(value))
    except Exception:
        return escape(str(value))
    return escape(f"{amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))


def render_invoice_preview_html(
    invoice: Invoice,
    *,
    document_type_label: str | None = None,
) -> str:
    customer = invoice.customer
    customer_name = escape(f"{customer.first_name} {customer.last_name}".strip() or "—")
    label = document_type_label or DOCUMENT_TYPE_LABELS["invoice"]
    lines = invoice.lines.select_related("product").all()

    rows = []
    for line in lines:
        name = escape(line.description or getattr(line.product, "name", None) or "—")
        rows.append(
            f"<tr>"
            f"<td>{name}</td>"
            f"<td class='num'>{line.quantity}</td>"
            f"<td class='num'>{_money(line.unit_price)}</td>"
            f"<td class='num'>{_money(line.line_total)}</td>"
            f"</tr>"
        )
    line_rows = "\n".join(rows) or "<tr><td colspan='4'>—</td></tr>"

    body = f"""
<div class="grid">
<div><strong>Fatura No:</strong> {escape(invoice.number)}</div>
<div><strong>Tarih:</strong> {escape(str(invoice.issued_at))}</div>
<div><strong>Müşteri:</strong> {customer_name}</div>
<div><strong>Durum:</strong> {escape(invoice.get_status_display())}</div>
</div>
<table>
<thead><tr><th>Kalem</th><th>Miktar</th><th>Birim Fiyat</th><th>Tutar</th></tr></thead>
<tbody>
{line_rows}
</tbody>
<tfoot>
<tr>
<th colspan="3" class="num">Toplam</th>
<th class="num">{_money(invoice.total)}</th>
</tr>
</tfoot>
</table>
<div class="footer">
<p>{escape(invoice.notes or "")}</p>
<p class="muted">Önizleme — resmi e-belge imza öncesi bilgilendirme amaçlıdır.</p>
</div>
"""
    return render_html_page(
        title=label.upper(),
        subtitle=f"{label} önizleme — {invoice.number}",
        body=body,
    )
