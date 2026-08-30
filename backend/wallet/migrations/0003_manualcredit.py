import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_interaction_phone_number_lead_contacted_at_and_more'),
        ('wallet', '0002_seed_pricing_rates'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ManualCredit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('amount_usd', models.DecimalField(decimal_places=2, max_digits=10)),
                ('transfer_date', models.DateField(help_text="Date the tenant says they sent the bank/SadaPay transfer.")),
                ('reference_note', models.CharField(blank=True, help_text="e.g. 'Screenshot in support chat' or a bank transaction reference.", max_length=255)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('processed_by', models.ForeignKey(blank=True, help_text='Which platform-owner admin verified and entered this credit.', null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='manual_credits', to='core.tenant')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddField(
            model_name='wallettransaction',
            name='related_manual_credit',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transactions', to='wallet.manualcredit'),
        ),
    ]