from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("accounts", "0002_initial"),
        ("products", "0001_initial"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="LabelTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.BigIntegerField(db_index=True)),
                ("name", models.CharField(max_length=128)),
                ("description", models.TextField(blank=True)),
                ("width_mm", models.DecimalField(decimal_places=2, max_digits=6)),
                ("height_mm", models.DecimalField(decimal_places=2, max_digits=6)),
                ("gap_mm", models.DecimalField(decimal_places=2, default=2, max_digits=6)),
                ("dpi", models.PositiveIntegerField(default=203)),
                ("layout_json", models.JSONField(default=list)),
                (
                    "source",
                    models.CharField(
                        choices=[("default", "Default"), ("custom", "Custom"), ("duplicate", "Duplicate")],
                        default="custom",
                        max_length=16,
                    ),
                ),
                ("default_key", models.CharField(blank=True, db_index=True, max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table": "label_template",
            },
        ),
        migrations.CreateModel(
            name="BarcodeAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.BigIntegerField(db_index=True)),
                ("symbology", models.CharField(default="EAN13", max_length=16)),
                ("qr_payload", models.CharField(blank=True, max_length=512)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "product",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="barcode_assignment",
                        to="products.product",
                    ),
                ),
            ],
            options={
                "db_table": "barcode_assignment",
            },
        ),
        migrations.CreateModel(
            name="PrintJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tenant_id", models.BigIntegerField(db_index=True)),
                ("product_ids", models.JSONField(default=list)),
                ("layout_snapshot", models.JSONField(default=dict)),
                ("template_snapshot", models.JSONField(default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("queued", "Queued"),
                            ("sent", "Sent"),
                            ("done", "Done"),
                            ("failed", "Failed"),
                        ],
                        default="queued",
                        max_length=16,
                    ),
                ),
                ("copies", models.PositiveIntegerField(default=1)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="barcode_print_jobs",
                        to="accounts.user",
                    ),
                ),
                (
                    "template",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="print_jobs",
                        to="barcode.labeltemplate",
                    ),
                ),
            ],
            options={
                "db_table": "barcode_print_job",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="labeltemplate",
            index=models.Index(fields=["tenant_id", "is_active"], name="label_templ_tenant__a1b2c3_idx"),
        ),
        migrations.AddIndex(
            model_name="labeltemplate",
            index=models.Index(fields=["tenant_id", "default_key"], name="label_templ_tenant__d4e5f6_idx"),
        ),
        migrations.AddConstraint(
            model_name="labeltemplate",
            constraint=models.UniqueConstraint(
                condition=models.Q(("default_key", ""), _negated=True),
                fields=("tenant_id", "default_key"),
                name="label_template_unique_default_key",
            ),
        ),
        migrations.AddIndex(
            model_name="printjob",
            index=models.Index(fields=["tenant_id", "status"], name="barcode_pri_tenant__g7h8i9_idx"),
        ),
        migrations.AddIndex(
            model_name="printjob",
            index=models.Index(fields=["tenant_id", "created_at"], name="barcode_pri_tenant__j0k1l2_idx"),
        ),
    ]
