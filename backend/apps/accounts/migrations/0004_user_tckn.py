from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_usersession"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="tckn",
            field=models.CharField(
                blank=True,
                help_text="Doctor/staff T.C. kimlik no (Medula e-Reçete).",
                max_length=11,
            ),
        ),
    ]
