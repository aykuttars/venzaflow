from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.customers.province_data import ensure_turkish_provinces


class Command(BaseCommand):
    help = "Load Turkish province reference data into turkish_province (idempotent)."

    def handle(self, *args, **options):
        stats = ensure_turkish_provinces()
        if stats["created"] or stats["updated"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Turkish provinces: {stats['created']} created, "
                    f"{stats['updated']} updated ({stats['total']} total)."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Turkish provinces already up to date ({stats['total']} rows).")
            )
