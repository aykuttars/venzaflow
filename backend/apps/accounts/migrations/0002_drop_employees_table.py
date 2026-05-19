"""Drop legacy employees_employee table (User is the employee record)."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            sql="DROP TABLE IF EXISTS employees_employee CASCADE;",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
