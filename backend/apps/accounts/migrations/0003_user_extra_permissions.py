from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_drop_employees_table"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="extra_permissions",
            field=models.ManyToManyField(
                blank=True,
                help_text="Additional permissions on top of the user's department.",
                related_name="users_with_extra",
                to="accounts.permission",
            ),
        ),
    ]
