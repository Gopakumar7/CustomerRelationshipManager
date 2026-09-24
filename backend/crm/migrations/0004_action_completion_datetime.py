from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0003_alter_action_options_alter_assessment_options_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="action",
            name="completion_date",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
