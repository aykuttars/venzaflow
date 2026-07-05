from __future__ import annotations

from apps.barcode.models import LabelTemplate, PrintJob, PrintJobStatus
from apps.barcode.services.settings import get_or_create_settings
from apps.service.models import ServiceTicket
from apps.service.services.transitions import ticket_snapshot

SERVICE_INTAKE_SHOP_KEY = "service_intake_shop"
SERVICE_INTAKE_CUSTOMER_KEY = "service_intake_customer"

INTAKE_COPY_LABELS = {
    SERVICE_INTAKE_SHOP_KEY: "Servis nüshası",
    SERVICE_INTAKE_CUSTOMER_KEY: "Müşteri nüshası",
}


def _template_by_key(tenant_id: int, default_key: str) -> LabelTemplate | None:
    return LabelTemplate.objects.filter(
        tenant_id=tenant_id,
        default_key=default_key,
        is_active=True,
    ).first()


def _layout_with_copy_label(template: LabelTemplate, copy_label: str) -> list[dict]:
    layout: list[dict] = []
    for elem in template.layout_json or []:
        if elem.get("data_binding") == "ticket.copy_label":
            patched = dict(elem)
            patched["static_text"] = copy_label
            layout.append(patched)
        else:
            layout.append(elem)
    return layout


def _create_ticket_print_job(
    ticket: ServiceTicket,
    *,
    template: LabelTemplate,
    copy_label: str,
    user,
    immediate: bool,
) -> PrintJob:
    snapshot = ticket_snapshot(ticket, copy_label=copy_label)
    layout = _layout_with_copy_label(template, copy_label)
    status = PrintJobStatus.SENT if immediate else PrintJobStatus.QUEUED
    return PrintJob.objects.create(
        tenant_id=ticket.tenant_id,
        template=template,
        product_ids=[],
        context_type="service_ticket",
        context_id=ticket.pk,
        context_snapshot=snapshot,
        layout_snapshot=layout,
        template_snapshot={
            "width_mm": str(template.width_mm),
            "height_mm": str(template.height_mm),
            "gap_mm": str(template.gap_mm),
            "dpi": template.dpi,
            "name": template.name,
        },
        copies=1,
        created_by=user if user and getattr(user, "is_authenticated", False) else None,
        status=status,
    )


def resolve_intake_template_pair(tenant_id: int) -> tuple[LabelTemplate | None, LabelTemplate | None]:
    from apps.barcode.services.seed_service_templates import ensure_service_templates

    ensure_service_templates(tenant_id)
    settings = get_or_create_settings(tenant_id)
    shop_tpl = settings.service_intake_shop_template
    if shop_tpl and shop_tpl.tenant_id == tenant_id and shop_tpl.is_active:
        shop = shop_tpl
    else:
        shop = _template_by_key(tenant_id, SERVICE_INTAKE_SHOP_KEY)

    customer_tpl = settings.service_intake_customer_template
    if customer_tpl and customer_tpl.tenant_id == tenant_id and customer_tpl.is_active:
        customer = customer_tpl
    else:
        customer = _template_by_key(tenant_id, SERVICE_INTAKE_CUSTOMER_KEY)
    return shop, customer


def enqueue_intake_labels(
    ticket: ServiceTicket,
    *,
    user=None,
    immediate: bool = True,
) -> list[PrintJob]:
    shop_tpl, cust_tpl = resolve_intake_template_pair(ticket.tenant_id)
    jobs: list[PrintJob] = []
    if shop_tpl:
        jobs.append(
            _create_ticket_print_job(
                ticket,
                template=shop_tpl,
                copy_label=INTAKE_COPY_LABELS[SERVICE_INTAKE_SHOP_KEY],
                user=user,
                immediate=immediate,
            )
        )
    if cust_tpl:
        jobs.append(
            _create_ticket_print_job(
                ticket,
                template=cust_tpl,
                copy_label=INTAKE_COPY_LABELS[SERVICE_INTAKE_CUSTOMER_KEY],
                user=user,
                immediate=immediate,
            )
        )
    return jobs
