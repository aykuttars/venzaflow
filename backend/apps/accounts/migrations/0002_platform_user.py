from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("tenants", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="tenant",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="users",
                to="tenants.tenant",
            ),
        ),
        migrations.AlterUniqueTogether(
            name="user",
            unique_together=set(),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                fields=("tenant", "email"),
                name="u_user_tenant_email",
            ),
        ),
        migrations.AddConstraint(
            model_name="user",
            constraint=models.UniqueConstraint(
                condition=models.Q(("tenant__isnull", True)),
                fields=("email",),
                name="u_platform_email",
            ),
        ),
    ]
