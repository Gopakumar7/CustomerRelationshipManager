from django.db import migrations, models
import django.db.models.deletion


def populate_interaction_company(apps, schema_editor):
    Interaction = apps.get_model("crm", "Interaction")
    for interaction in Interaction.objects.select_related("opportunity").iterator():
        interaction.company_id = interaction.opportunity.company_id
        interaction.save(update_fields=["company"])


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="company",
            old_name="notes",
            new_name="general_notes",
        ),
        migrations.AddField(
            model_name="company",
            name="source",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.RemoveField(
            model_name="company",
            name="company_type",
        ),
        migrations.RemoveField(
            model_name="company",
            name="phone",
        ),
        migrations.RemoveField(
            model_name="company",
            name="email",
        ),
        migrations.RemoveField(
            model_name="company",
            name="address",
        ),
        migrations.RenameField(
            model_name="contact",
            old_name="full_name",
            new_name="name",
        ),
        migrations.RenameField(
            model_name="contact",
            old_name="job_title",
            new_name="designation",
        ),
        migrations.AddField(
            model_name="contact",
            name="whatsapp",
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.RemoveField(
            model_name="contact",
            name="preferred_contact_method",
        ),
        migrations.RemoveField(
            model_name="contact",
            name="is_primary",
        ),
        migrations.RenameField(
            model_name="opportunity",
            old_name="name",
            new_name="title",
        ),
        migrations.RenameField(
            model_name="opportunity",
            old_name="expected_close_date",
            new_name="expected_decision_date",
        ),
        migrations.AddField(
            model_name="opportunity",
            name="notes",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="opportunity",
            name="priority",
            field=models.CharField(
                choices=[
                    ("low", "Low"),
                    ("medium", "Medium"),
                    ("high", "High"),
                ],
                default="medium",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="interaction",
            name="company",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="interactions",
                to="crm.company",
            ),
        ),
        migrations.RenameField(
            model_name="interaction",
            old_name="summary",
            new_name="details",
        ),
        migrations.RemoveField(
            model_name="interaction",
            name="contact",
        ),
        migrations.RemoveField(
            model_name="interaction",
            name="direction",
        ),
        migrations.RunPython(
            populate_interaction_company,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="interaction",
            name="company",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="interactions",
                to="crm.company",
            ),
        ),
        migrations.RenameField(
            model_name="assessment",
            old_name="assessment",
            new_name="thoughts",
        ),
        migrations.RenameField(
            model_name="assessment",
            old_name="confidence",
            new_name="opportunity_level",
        ),
        migrations.AddField(
            model_name="assessment",
            name="concerns",
            field=models.TextField(blank=True),
        ),
        migrations.RenameField(
            model_name="action",
            old_name="title",
            new_name="action_description",
        ),
        migrations.RenameField(
            model_name="action",
            old_name="details",
            new_name="notes",
        ),
        migrations.RenameField(
            model_name="action",
            old_name="completed_at",
            new_name="completion_date",
        ),
        migrations.AlterField(
            model_name="action",
            name="completion_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="action",
            name="priority",
            field=models.CharField(
                choices=[
                    ("low", "Low"),
                    ("medium", "Medium"),
                    ("high", "High"),
                ],
                default="medium",
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name="futureplan",
            name="opportunity",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="future_plans",
                to="crm.opportunity",
            ),
        ),
        migrations.AddIndex(
            model_name="company",
            index=models.Index(fields=["name"], name="crm_company_name_7c7c9e_idx"),
        ),
        migrations.AddIndex(
            model_name="company",
            index=models.Index(
                fields=["lifecycle_status"],
                name="crm_company_lifecyc_03c56b_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(
                fields=["company", "name"],
                name="crm_contact_company_6c2f74_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="contact",
            index=models.Index(fields=["email"], name="crm_contact_email_5e7f36_idx"),
        ),
        migrations.AddIndex(
            model_name="opportunity",
            index=models.Index(
                fields=["company", "status"],
                name="crm_opport_company_8e0e6f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="opportunity",
            index=models.Index(
                fields=["status", "priority"],
                name="crm_opport_status_5f4e5b_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="opportunity",
            index=models.Index(
                fields=["expected_decision_date"],
                name="crm_opport_expecte_8d5e76_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="interaction",
            index=models.Index(
                fields=["company", "-occurred_at"],
                name="crm_interac_company_3ee0e3_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="interaction",
            index=models.Index(
                fields=["opportunity", "-occurred_at"],
                name="crm_interac_opportu_530bab_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="assessment",
            index=models.Index(
                fields=["opportunity", "-created_at"],
                name="crm_assess_opportu_0c4e8f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="action",
            index=models.Index(
                fields=["opportunity", "status"],
                name="crm_action_opportu_56b1ef_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="action",
            index=models.Index(
                fields=["status", "due_date"],
                name="crm_action_status_1bc13a_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="futureplan",
            index=models.Index(
                fields=["opportunity", "status"],
                name="crm_futurepl_opportu_4baf63_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="futureplan",
            index=models.Index(
                fields=["target_date"],
                name="crm_futurepl_target_8c2df1_idx",
            ),
        ),
    ]
