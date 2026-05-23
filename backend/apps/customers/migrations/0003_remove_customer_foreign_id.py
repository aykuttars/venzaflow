from django.db import migrations


def migrate_foreign_id_to_tckn(apps, schema_editor):
    Customer = apps.get_model("customers", "Customer")
    for row in Customer.objects.exclude(foreign_id="").filter(tckn=""):
        row.tckn = row.foreign_id[:11]
        row.save(update_fields=["tckn"])


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(migrate_foreign_id_to_tckn, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="customer",
            name="foreign_id",
        ),
    ]
