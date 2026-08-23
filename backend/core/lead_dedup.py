"""
Shared "is this lead already in the database" logic.

Used by the scraper (scraper.tasks) and, going forward, bulk CSV/Excel
upload — anywhere a new lead's details arrive from outside the CRM UI and
might already exist. The rule: an email match OR a phone match against an
existing lead in the same tenant means it's the same lead, not a new one.
"""

from core.models import Lead


def find_or_create_lead(tenant, email="", phone="", defaults=None, owner=None, scrape_task=None):
    """
    Returns (lead, created).

    Looks for an existing Lead in this tenant matching by email first, then
    by phone number, treating either as "this is the same lead" (this is
    stricter than requiring both to match, since a lead might be scraped
    once with only an email and again later with only a phone number).

    If found: backfills any contact detail that was missing (e.g. adds the
    phone number if the existing record only had an email), rather than
    creating a duplicate row.

    If not found: creates a new Lead with the given defaults.
    """
    defaults = defaults or {}
    email = (email or "").strip()
    phone = (phone or "").strip()

    lead = None
    if email:
        lead = Lead.objects.filter(tenant=tenant, email__iexact=email).first()
    if lead is None and phone:
        lead = Lead.objects.filter(tenant=tenant, phone_number=phone).first()

    if lead:
        update_fields = []
        if email and not lead.email:
            lead.email = email
            update_fields.append("email")
        if phone and not lead.phone_number:
            lead.phone_number = phone
            update_fields.append("phone_number")
        # Fill in any other blank fields we now have better data for
        # (e.g. a bulk upload supplying an address for a lead the scraper
        # only found a name and phone number for), without overwriting
        # anything already on file.
        for field, value in defaults.items():
            if value and not getattr(lead, field, None):
                setattr(lead, field, value)
                update_fields.append(field)
        if update_fields:
            lead.save(update_fields=update_fields)
        return lead, False

    lead = Lead.objects.create(
        tenant=tenant,
        email=email,
        phone_number=phone,
        owner=owner,
        scrape_task=scrape_task,
        **defaults,
    )
    return lead, True