from django.db import migrations, models


def seed_turkish_provinces(apps, schema_editor):
    from apps.customers.province_data import TURKISH_PROVINCES

    TurkishProvince = apps.get_model("customers", "TurkishProvince")
    TurkishProvince.objects.bulk_create(
        [TurkishProvince(plate_code=plate, name=name) for plate, name in TURKISH_PROVINCES],
        ignore_conflicts=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0003_remove_customer_foreign_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="TurkishProvince",
            fields=[
                (
                    "plate_code",
                    models.PositiveSmallIntegerField(primary_key=True, serialize=False),
                ),
                ("name", models.CharField(max_length=64)),
            ],
            options={
                "verbose_name": "Turkish province",
                "verbose_name_plural": "Turkish provinces",
                "db_table": "turkish_province",
                "ordering": ["name"],
            },
        ),
        migrations.RunPython(seed_turkish_provinces, migrations.RunPython.noop),
    ]
