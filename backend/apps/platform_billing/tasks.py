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
