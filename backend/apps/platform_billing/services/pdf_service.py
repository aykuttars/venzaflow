from __future__ import annotations

from django.template.loader import render_to_string

from apps.platform_billing.models import PlatformBillingSettings, TenantSubscriptionInvoice


def render_invoice_pdf(invoice: TenantSubscriptionInvoice) -> bytes:
    from weasyprint import HTML

    settings = PlatformBillingSettings.get_solo()
    html = render_to_string(
        "platform_billing/invoice_pdf.html",
        {
            "invoice": invoice,
            "lines": invoice.lines.all(),
            "settings": settings,
            "tenant": invoice.tenant,
        },
    )
    return HTML(string=html).write_pdf()
