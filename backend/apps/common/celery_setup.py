from __future__ import annotations

from django.conf import settings
from django_celery_beat.models import CrontabSchedule, PeriodicTask


def ensure_periodic_tasks() -> None:
    """Seed django-celery-beat schedules (idempotent). Runs at minute 0 every hour in TIME_ZONE."""
    tz = settings.TIME_ZONE
    tcmb_schedule, _ = CrontabSchedule.objects.get_or_create(
        minute="0",
        hour="*",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
        timezone=tz,
    )
    billing_queue = f"{settings.CELERY_QUEUE_PREFIX}_billing"
    task, _ = PeriodicTask.objects.update_or_create(
        name="platform-billing-fetch-tcmb",
        defaults={
            "task": "platform_billing.fetch_tcmb_exchange_rates",
            "crontab": tcmb_schedule,
            "interval": None,
            "queue": billing_queue,
            "enabled": True,
            "description": "Fetch TCMB exchange rates (USD, EUR, GBP) at the start of each hour",
        },
    )
    if task.crontab_id != tcmb_schedule.pk:
        task.crontab = tcmb_schedule
        task.interval = None
        task.save(update_fields=["crontab", "interval"])
