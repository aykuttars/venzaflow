"""Load Celery app when Django starts (enables @shared_task binding)."""

from .celery import app as celery_app

__all__ = ("celery_app",)
