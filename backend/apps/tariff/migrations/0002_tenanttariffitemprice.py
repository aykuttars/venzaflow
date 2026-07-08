# Generated manually for TDB tenant tariff prices

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0001_initial"),
        ("tariff", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantTariffItemPrice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("clinic_price_excl_vat", models.DecimalField(decimal_places=2, max_digits=12)),
                ("clinic_price_incl_vat", models.DecimalField(decimal_places=2, max_digits=12)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tariff_item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tenant_prices",
                        to="tariff.dentaltariffitem",
                    ),
                ),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tariff_item_prices",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "tenant_tariff_item_price",
                "indexes": [
                    models.Index(fields=["tenant", "tariff_item"], name="tenant_tari_tenant__a1b2c3_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("tenant", "tariff_item"),
                        name="tenant_tariff_item_price_unique",
                    ),
                ],
            },
        ),
    ]
