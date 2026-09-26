from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("wallet", "0006_seed_missing_rates"),
    ]

    operations = [
        migrations.AddConstraint(
            model_name="wallettransaction",
            constraint=models.UniqueConstraint(
                fields=["related_interaction"],
                condition=models.Q(related_interaction__isnull=False),
                name="unique_wallettransaction_per_interaction",
            ),
        ),
        migrations.AddConstraint(
            model_name="wallettransaction",
            constraint=models.UniqueConstraint(
                fields=["related_scrape_task"],
                condition=models.Q(related_scrape_task__isnull=False),
                name="unique_wallettransaction_per_scrape_task",
            ),
        ),
    ]