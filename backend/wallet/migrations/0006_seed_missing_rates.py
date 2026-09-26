from decimal import Decimal

from django.db import migrations

NEW_RATES = [
    ("sms_outbound_per_segment", Decimal("0.0160"), "per segment"),
    ("sms_inbound_per_segment", Decimal("0.0080"), "per segment"),
    ("platform_fee_monthly", Decimal("49.00"), "per month"),
]


def seed_rates(apps, schema_editor):
    PricingRate = apps.get_model("wallet", "PricingRate")
    for key, cost, unit in NEW_RATES:
        PricingRate.objects.get_or_create(
            key=key, defaults={"cost_usd": cost, "unit": unit, "is_active": True}
        )
    # The old combined key is superseded by the outbound/inbound split above —
    # deactivate it rather than delete it, so historical rows referencing it
    # (if any) still resolve, but PricingRate.get_cost() never returns it.
    PricingRate.objects.filter(key="sms_per_segment").update(is_active=False)


def unseed_rates(apps, schema_editor):
    PricingRate = apps.get_model("wallet", "PricingRate")
    PricingRate.objects.filter(key__in=[k for k, _, _ in NEW_RATES]).delete()
    PricingRate.objects.filter(key="sms_per_segment").update(is_active=True)


class Migration(migrations.Migration):

    dependencies = [
        ("wallet", "0005_alter_pricingrate_key_alter_wallettransaction_type"),
    ]

    operations = [
        migrations.RunPython(seed_rates, unseed_rates),
    ]