from __future__ import annotations

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

User = get_user_model()


class Command(BaseCommand):
    help = "Create or update a platform super admin (no tenant)."

    def add_arguments(self, parser):
        parser.add_argument("--email", required=True, help="Platform admin email")
        parser.add_argument("--password", required=True, help="Platform admin password")

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]
        user, created = User.all_tenants.get_or_create(
            tenant=None,
            email=email,
            defaults={
                "is_superuser": True,
                "is_staff": True,
                "is_active": True,
            },
        )
        user.is_superuser = True
        user.is_staff = True
        user.is_active = True
        user.tenant = None
        user.department = None
        user.set_password(password)
        user.save()
        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} platform admin {email}"))
