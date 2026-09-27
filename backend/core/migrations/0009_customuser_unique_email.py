from django.db import migrations, models
from django.db.models import Count
from django.db.models.functions import Lower


def check_no_duplicate_emails(apps, schema_editor):
    CustomUser = apps.get_model("core", "CustomUser")
    dupes = (
        CustomUser.objects.exclude(email="")
        .annotate(email_lower=Lower("email"))
        .values("email_lower")
        .annotate(dupe_count=Count("id"))
        .filter(dupe_count__gt=1)
    )
    if dupes.exists():
        emails = ", ".join(d["email_lower"] for d in dupes)
        raise RuntimeError(
            "Cannot add the unique-email constraint: the following email "
            f"address(es) are already shared by more than one account "
            f"(case-insensitive): {emails}. Resolve these duplicates manually "
            "(e.g. correct or blank out the email on one of each pair) in "
            "Django admin, then re-run `python manage.py migrate`."
        )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0008_phonenumber_deactivated_at_and_more"),
    ]

    operations = [
        migrations.RunPython(check_no_duplicate_emails, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="customuser",
            constraint=models.UniqueConstraint(
                Lower("email"),
                condition=models.Q(("email", ""), _negated=True),
                name="unique_user_email_ci",
                violation_error_message="A user with this email already exists.",
            ),
        ),
    ]