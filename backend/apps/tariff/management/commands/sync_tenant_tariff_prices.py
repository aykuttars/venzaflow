from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.tariff.services.tenant_prices import enforce_override_floors, prune_redundant_overrides
from apps.tariff.services.tenant_year_sync import oral_tenant_ids


class Command(BaseCommand):
    help = "Enforce floor on existing tenant tariff overrides and prune redundant base-price rows."

    def add_arguments(self, parser):
        parser.add_argument(
            "--all-tenants",
            action="store_true",
            help="Process all oral-enabled tenants",
        )
        parser.add_argument(
            "--tenant-id",
            type=int,
            help="Single tenant id",
        )
        parser.add_argument(
            "--prune-only",
            action="store_true",
            help="Only delete override rows that mirror the base tariff",
        )

    def handle(self, *args, **options):
        if options["tenant_id"]:
            tenant_ids = [options["tenant_id"]]
        elif options["all_tenants"]:
            tenant_ids = oral_tenant_ids()
        else:
            self.stderr.write("Specify --all-tenants or --tenant-id")
            return

        for tenant_id in tenant_ids:
            if options["prune_only"]:
                pruned = prune_redundant_overrides(tenant_id=tenant_id)
                self.stdout.write(self.style.SUCCESS(f"Tenant {tenant_id}: pruned={pruned}"))
            else:
                stats = enforce_override_floors(tenant_id)
                self.stdout.write(self.style.SUCCESS(f"Tenant {tenant_id}: {stats}"))
