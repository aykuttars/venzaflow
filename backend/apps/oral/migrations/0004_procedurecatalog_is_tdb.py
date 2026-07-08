# Generated manually for TDB procedure flag

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("oral", "0003_procedurecatalog_tariff_item"),
    ]

    operations = [
        migrations.AddField(
            model_name="procedurecatalog",
            name="is_tdb",
            field=models.BooleanField(
                default=False,
                help_text="True when synced from platform TDB tariff catalog.",
            ),
        ),
    ]
