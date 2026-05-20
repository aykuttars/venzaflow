from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.platform_billing.tasks import fetch_tcmb_exchange_rates


class Command(BaseCommand):
    help = "Fetch TCMB exchange rates (EUR, GBP) and persist to ExchangeRate."

    def handle(self, *args, **options):
        result = fetch_tcmb_exchange_rates()
        self.stdout.write(self.style.SUCCESS(f"TCMB rates saved: {result}"))
