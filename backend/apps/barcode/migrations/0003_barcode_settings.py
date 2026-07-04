# Generated migration for BarcodeSettings and template department keys

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tenants", "0001_initial"),
        ("barcode", "0002_seed_module"),
    ]

    operations = [
        migrations.AddField(
            model_name="labeltemplate",
            name="allowed_department_keys",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name="BarcodeSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "scan_miss_action",
                    models.CharField(
                        choices=[
                            ("ignore", "Ignore"),
                            ("assign_existing", "Assign to existing product"),
                            ("create_wizard", "Create product wizard"),
                        ],
                        default="create_wizard",
                        max_length=32,
                    ),
                ),
                ("normalize_tr_scan", models.BooleanField(default=True)),
                (
                    "qr_content_mode",
                    models.CharField(
                        choices=[
                            ("barcode", "Barcode only"),
                            ("sku", "SKU only"),
                            ("compact_detail", "Compact product detail"),
                        ],
                        default="barcode",
                        max_length=32,
                    ),
                ),
                ("qr_max_length", models.PositiveIntegerField(default=128)),
                ("ean_prefix", models.CharField(default="869", max_length=3)),
                ("auto_generate_on_create", models.BooleanField(default=False)),
                ("operation_flags", models.JSONField(default=dict)),
                (
                    "stock_deduction_mode",
                    models.CharField(
                        choices=[
                            ("off", "Off"),
                            ("on_invoice", "On invoice"),
                            ("on_manual_confirm", "Manual confirm"),
                            ("both", "Both"),
                        ],
                        default="both",
                        max_length=32,
                    ),
                ),
                (
                    "print_mode",
                    models.CharField(
                        choices=[
                            ("queue_only", "Queue only"),
                            ("immediate", "Immediate"),
                            ("both", "Both"),
                        ],
                        default="both",
                        max_length=32,
                    ),
                ),
                ("default_copies", models.PositiveIntegerField(default=1)),
                ("default_transfer_qty", models.PositiveIntegerField(default=1)),
                ("printer_model", models.CharField(default="XP-P328B", max_length=64)),
                ("printer_profile_json", models.JSONField(default=dict)),
                ("label_logo", models.ImageField(blank=True, null=True, upload_to="barcode/logos/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="barcode_settings",
                        to="tenants.tenant",
                    ),
                ),
            ],
            options={
                "db_table": "barcode_settings",
            },
        ),
    ]
