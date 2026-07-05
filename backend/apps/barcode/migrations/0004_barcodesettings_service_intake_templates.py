from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("barcode", "0003_printjob_context_id_printjob_context_snapshot_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="barcodesettings",
            name="service_intake_customer_template",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="service_intake_customer_defaults",
                to="barcode.labeltemplate",
            ),
        ),
        migrations.AddField(
            model_name="barcodesettings",
            name="service_intake_shop_template",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="service_intake_shop_defaults",
                to="barcode.labeltemplate",
            ),
        ),
    ]
