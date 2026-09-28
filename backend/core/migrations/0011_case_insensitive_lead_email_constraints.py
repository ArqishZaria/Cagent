from django.db import migrations, models
from django.db.models import Count
from django.db.models.functions import Lower


def check_no_duplicate_lead_emails(apps, schema_editor):
    """
    Per-tenant check (Lead's constraint is scoped by tenant, unlike
    CustomUser/MasterLead which are global) — two leads in DIFFERENT
    tenants are allowed to share an email; only within the same tenant is
    it a conflict.
    """
    Lead = apps.get_model("core", "Lead")
    dupes = (
        Lead.objects.exclude(email="")
        .annotate(email_lower=Lower("email"))
        .values("tenant_id", "email_lower")
        .annotate(dupe_count=Count("id"))
        .filter(dupe_count__gt=1)
    )
    if dupes.exists():
        details = ", ".join(f"tenant {d['tenant_id']}: {d['email_lower']}" for d in dupes)
        raise RuntimeError(
            "Cannot add the case-insensitive unique-email constraint on Lead: the "
            f"following tenant/email pair(s) already have more than one lead sharing "
            f"the same email address (case-insensitive): {details}. Resolve these "
            "duplicates manually in Django admin (correct or blank the email on one "
            "of each pair) before re-running `python manage.py migrate`."
        )


def check_no_duplicate_masterlead_emails(apps, schema_editor):
    """MasterLead is a single global pool (not tenant-scoped), so this check
    is global, matching its existing constraint's scope."""
    MasterLead = apps.get_model("core", "MasterLead")
    dupes = (
        MasterLead.objects.exclude(email="")
        .annotate(email_lower=Lower("email"))
        .values("email_lower")
        .annotate(dupe_count=Count("id"))
        .filter(dupe_count__gt=1)
    )
    if dupes.exists():
        emails = ", ".join(d["email_lower"] for d in dupes)
        raise RuntimeError(
            "Cannot add the case-insensitive unique-email constraint on MasterLead: "
            f"the following email address(es) already have more than one master lead "
            f"sharing them (case-insensitive): {emails}. Resolve these duplicates "
            "manually in Django admin (correct or blank the email on one of each "
            "pair) before re-running `python manage.py migrate`."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_alter_customuser_options"),
    ]

    operations = [
        migrations.RunPython(check_no_duplicate_lead_emails, migrations.RunPython.noop),
        migrations.RunPython(check_no_duplicate_masterlead_emails, migrations.RunPython.noop),

        migrations.RemoveConstraint(
            model_name="lead",
            name="unique_tenant_email_when_present",
        ),
        migrations.AddConstraint(
            model_name="lead",
            constraint=models.UniqueConstraint(
                Lower("email"),
                "tenant",
                condition=models.Q(("email", ""), _negated=True),
                name="unique_tenant_email_ci_when_present",
                violation_error_message="A lead with this email already exists.",
            ),
        ),

        migrations.RemoveConstraint(
            model_name="masterlead",
            name="unique_master_email_when_present",
        ),
        migrations.AddConstraint(
            model_name="masterlead",
            constraint=models.UniqueConstraint(
                Lower("email"),
                condition=models.Q(("email", ""), _negated=True),
                name="unique_master_email_ci_when_present",
                violation_error_message="A master lead with this email already exists.",
            ),
        ),
    ]