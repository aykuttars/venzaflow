from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.tariff.models import DentalTariff, DentalTariffItem
from apps.tariff.services.parser import parse_tariff_pdf


class Command(BaseCommand):
    help = "Import TDB dental tariff from PDF (pdftotext -layout required)."

    def add_arguments(self, parser):
        parser.add_argument("pdf_path", type=str, help="Path to tariff PDF")
        parser.add_argument("--year", type=int, required=True, help="Tariff year e.g. 2026")
        parser.add_argument(
            "--title",
            type=str,
            default="",
            help="Optional title override",
        )
        parser.add_argument(
            "--activate",
            action="store_true",
            help="Set this tariff as the active year (deactivates others)",
        )
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Replace existing items for the same year",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        pdf_path = options["pdf_path"]
        year = options["year"]
        title = options["title"] or f"{year} TDB Rehber Tarife"
        activate = options["activate"]
        replace = options["replace"]

        try:
            parsed = parse_tariff_pdf(pdf_path)
        except (OSError, RuntimeError, ValueError) as exc:
            raise CommandError(str(exc)) from exc

        tariff, created = DentalTariff.objects.get_or_create(
            year=year,
            defaults={
                "title": title,
                "source_note": pdf_path,
                "is_active": False,
            },
        )
        if not created:
            if not replace:
                raise CommandError(
                    f"Tariff for year {year} already exists. Use --replace to overwrite items."
                )
            tariff.title = title
            tariff.source_note = pdf_path
            tariff.save(update_fields=["title", "source_note", "updated_at"])
            tariff.items.all().delete()

        DentalTariffItem.objects.bulk_create(
            [
                DentalTariffItem(
                    tariff=tariff,
                    section_no=item.section_no,
                    section_name=item.section_name,
                    code=item.code,
                    name=item.name,
                    price_incl_vat=item.price_incl_vat,
                )
                for item in parsed
            ],
            batch_size=500,
        )

        if activate:
            DentalTariff.objects.exclude(pk=tariff.pk).update(is_active=False)
            tariff.is_active = True
            tariff.save(update_fields=["is_active", "updated_at"])
            from apps.tariff.services.tenant_year_sync import sync_active_tariff_to_all_tenants

            sync_stats = sync_active_tariff_to_all_tenants(tariff=tariff)
            self.stdout.write(self.style.SUCCESS(f"Tenant sync: {sync_stats}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {len(parsed)} items for {year} "
                f"({'activated' if activate else 'not activated'})."
            )
        )
