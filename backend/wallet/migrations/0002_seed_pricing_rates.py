from decimal import Decimal

from django.db import migrations, models

DEFAULT_RATES = [
    ("call_outbound_per_minute", Decimal("0.0070"), "per minute"),
    ("call_inbound_per_minute", Decimal("0.0035"), "per minute"),
    ("sms_per_segment", Decimal("0.0070"), "per segment"),
    ("number_monthly_rental", Decimal("1.0000"), "per number/month"),
    ("number_sms_capability_fee", Decimal("0.1000"), "per number/month"),
    ("ten_dlc_campaign_fee", Decimal("10.0000"), "per month"),
    ("lead_search_per_query", Decimal("0.5000"), "per search"),
    ("lead_verification_per_row", Decimal("0.1500"), "per row"),
]


def seed_rates(apps, schema_editor):
    PricingRate = apps.get_model("wallet", "PricingRate")
    for key, cost, unit in DEFAULT_RATES:
        PricingRate.objects.get_or_create(key=key, defaults={"cost_usd": cost, "unit": unit, "is_active": True})


def unseed_rates(apps, schema_editor):
    PricingRate = apps.get_model("wallet", "PricingRate")
    PricingRate.objects.filter(key__in=[k for k, _, _ in DEFAULT_RATES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("wallet", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pricingrate",
            name="key",
            field=models.CharField(
                choices=[
                    ("call_outbound_per_minute", "Outbound call — per minute"),
                    ("call_inbound_per_minute", "Inbound call — per minute"),
                    ("sms_per_segment", "SMS — per segment"),
                    ("number_monthly_rental", "Phone number — monthly rental"),
                    ("number_sms_capability_fee", "Phone number — SMS capability add-on (monthly)"),
                    ("ten_dlc_campaign_fee", "10DLC campaign fee (monthly)"),
                    ("lead_search_per_query", "Prospector web search — per query"),
                    ("lead_verification_per_row", "Bulk upload — per-row verification"),
                ],
                max_length=64,
                unique=True,
            ),
        ),
        migrations.AlterField(
            model_name="wallettransaction",
            name="type",
            field=models.CharField(
                choices=[
                    ("TOPUP", "Top-up"),
                    ("USAGE_CALL", "Call"),
                    ("USAGE_SMS", "SMS"),
                    ("USAGE_LEAD_SEARCH", "Lead search"),
                    ("USAGE_LEAD_VERIFICATION", "Lead verification"),
                    ("USAGE_NUMBER_RENTAL", "Number rental"),
                    ("USAGE_OTHER", "Other"),
                    ("ADJUSTMENT", "Manual adjustment"),
                ],
                max_length=24,
            ),
        ),
        migrations.RunPython(seed_rates, unseed_rates),
    ]