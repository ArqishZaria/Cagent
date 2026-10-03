from datetime import timedelta
from django.db import migrations
from django.utils import timezone


def backfill(apps, schema_editor):
    Tenant = apps.get_model("core", "Tenant")
    # Tenants created before the signal existed were never scheduled for the
    # monthly fee. Give them a full 30 days from now. Change to timezone.now()
    # if you want them charged on tomorrow's sweep instead.
    Tenant.objects.filter(next_platform_fee_charge_at__isnull=True).update(
        next_platform_fee_charge_at=timezone.now() + timedelta(days=30)
    )


class Migration(migrations.Migration):
    dependencies = [("core", "0011_case_insensitive_lead_email_constraints")]
    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]