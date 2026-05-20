from __future__ import annotations

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(name="platform_billing.fetch_tcmb_exchange_rates")
def fetch_tcmb_exchange_rates():
    from apps.platform_billing.services.fx_service import persist_tcmb_rates
    from apps.platform_billing.services.tcmb import fetch_tcmb_rates

    try:
        rates = fetch_tcmb_rates()
        count = persist_tcmb_rates(rates)
        logger.info("TCMB rates saved: %s entries", count)
        return {"saved": count}
    except Exception as exc:
        logger.exception("TCMB fetch failed: %s", exc)
        raise


@shared_task(name="platform_billing.generate_subscription_invoices")
def generate_subscription_invoices():
    from apps.platform_billing.services.invoice_service import (
        generate_invoices_for_all_tenants,
    )

    try:
        result = generate_invoices_for_all_tenants(issue=True)
        logger.info(
            "Subscription invoices: created=%s skipped=%s errors=%s",
            result["created"],
            result["skipped"],
            len(result["errors"]),
        )
        return result
    except Exception as exc:
        logger.exception("Subscription invoice generation failed: %s", exc)
        raise
