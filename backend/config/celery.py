import os

import django
from celery import Celery
from kombu import Exchange, Queue

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
django.setup()

from django.conf import settings  # noqa: E402

queue_prefix = settings.CELERY_QUEUE_PREFIX
default_q = f"{queue_prefix}_default"
billing_q = f"{queue_prefix}_billing"

app.conf.update(
    task_default_queue=default_q,
    task_queues=(
        Queue(default_q, Exchange(default_q), routing_key="default"),
        Queue(billing_q, Exchange(f"{queue_prefix}_billing"), routing_key="billing"),
    ),
    task_routes={
        "platform_billing.*": {"queue": billing_q},
    },
    broker_connection_retry_on_startup=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

app.autodiscover_tasks()
