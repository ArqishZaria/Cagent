from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_interaction_phone_number_lead_contacted_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='interaction',
            name='missed',
            field=models.BooleanField(
                default=False,
                help_text="True for inbound calls auto-declined due to insufficient wallet balance.",
            ),
        ),
    ]