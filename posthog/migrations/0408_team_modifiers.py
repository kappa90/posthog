# Generated by Django 4.2.11 on 2024-05-02 19:06

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("posthog", "0407_verbose_name_for_team_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="team",
            name="modifiers",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
