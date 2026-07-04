from __future__ import annotations

from apps.barcode.models import LabelTemplate, PrintJob, PrintJobStatus
from apps.service.models import ServiceTicket
from apps.service.services.transitions import ticket_snapshot


def _template_by_key(tenant_id: int, default_key: str) -> LabelTemplate | None:
    return LabelTemplate.objects.filter(
        tenant_id=tenant_id,
        default_key=default_key,
        is_active=True,
    ).first()


def _create_ticket_print_job(
    ticket: ServiceTicket,
    *,
    template: LabelTemplate,
    copy_label: str,
    user,
    immediate: bool,
) -> PrintJob:
    snapshot = ticket_snapshot(ticket, copy_label=copy_label)
    layout = list(template.layout_json or [])
    for elem in layout:
        if elem.get("data_binding") == "ticket.copy_label":
            elem = dict(elem)
            elem["static_text"] = copy_label
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


def enqueue_intake_labels(
    ticket: ServiceTicket,
    *,
    user=None,
    immediate: bool = True,
) -> list[PrintJob]:
    from apps.barcode.services.seed_service_templates import ensure_service_templates

    ensure_service_templates(ticket.tenant_id)
    shop_tpl = _template_by_key(ticket.tenant_id, "service_intake_shop")
    cust_tpl = _template_by_key(ticket.tenant_id, "service_intake_customer")
    jobs: list[PrintJob] = []
    if shop_tpl:
        jobs.append(
            _create_ticket_print_job(
                ticket,
                template=shop_tpl,
                copy_label="Servis nüshası",
                user=user,
                immediate=immediate,
            )
        )
    if cust_tpl:
        jobs.append(
            _create_ticket_print_job(
                ticket,
                template=cust_tpl,
                copy_label="Müşteri nüshası",
                user=user,
                immediate=immediate,
            )
        )
    return jobs
