"""
The Master Database — a platform-wide pool of verified leads shared
read-only across every tenant.
"""

from django.db.models import Q

from core.models import Lead, MasterLead
from core.search_utils import keyword_filter

MASTER_MATCH_FIELDS = ["company", "city", "state", "job_title", "first_name", "last_name", "keywords"]
LEAD_MATCH_FIELDS = ["company", "city", "state", "job_title", "first_name", "last_name"]

MASTER_LEAD_COPY_FIELDS = (
    "first_name", "last_name", "job_title", "company", "website", "address", "city", "state",
)


def _build_keywords(query, data):
    parts = set((query or "").lower().split())
    for field in ("company", "job_title", "city", "state"):
        value = (data.get(field) or "").strip().lower()
        if value:
            parts.update(value.split())
    return " ".join(sorted(parts))[:500]


def count_existing_tenant_matches(tenant, query):
    return Lead.objects.filter(tenant=tenant).filter(keyword_filter(LEAD_MATCH_FIELDS, query)).count()


def pull_from_master(tenant, query, limit, owner=None, scrape_task=None):
    if limit <= 0:
        return []

    tenant_emails = {
        e.lower() for e in Lead.objects.filter(tenant=tenant).exclude(email="").values_list("email", flat=True)
    }
    tenant_phones = set(
        Lead.objects.filter(tenant=tenant).exclude(phone_number="").values_list("phone_number", flat=True)
    )

    candidates = (
        MasterLead.objects.filter(do_not_contact=False)
        .filter(keyword_filter(MASTER_MATCH_FIELDS, query))
        .order_by("-verified_at")
    )

    created = []
    for m in candidates:
        if len(created) >= limit:
            break
        if m.email and m.email.lower() in tenant_emails:
            continue
        if m.phone_number and m.phone_number in tenant_phones:
            continue

        lead = Lead.objects.create(
            tenant=tenant,
            owner=owner,
            scrape_task=scrape_task,
            phone_number=m.phone_number,
            email=m.email,
            status=Lead.Status.NEW,
            **{f: getattr(m, f) for f in MASTER_LEAD_COPY_FIELDS},
        )
        created.append(lead)
        if lead.email:
            tenant_emails.add(lead.email.lower())
        if lead.phone_number:
            tenant_phones.add(lead.phone_number)

    return created


def upsert_master_lead(data, query="", source_tenant=None):
    email = (data.get("email") or "").strip()
    phone = (data.get("phone_number") or "").strip()
    if not email and not phone:
        return None

    existing = None
    if email:
        existing = MasterLead.objects.filter(email__iexact=email).first()
    if existing is None and phone:
        existing = MasterLead.objects.filter(phone_number=phone).first()

    keywords = _build_keywords(query, data)

    if existing:
        update_fields = []
        if email and not existing.email:
            existing.email = email
            update_fields.append("email")
        if phone and not existing.phone_number:
            existing.phone_number = phone
            update_fields.append("phone_number")
        if keywords:
            merged = set(existing.keywords.split()) | set(keywords.split())
            existing.keywords = " ".join(sorted(merged))[:500]
            update_fields.append("keywords")
        for field in MASTER_LEAD_COPY_FIELDS:
            value = data.get(field)
            if value and not getattr(existing, field, None):
                setattr(existing, field, value)
                update_fields.append(field)
        if update_fields:
            existing.save(update_fields=update_fields)
        return existing

    return MasterLead.objects.create(
        email=email,
        phone_number=phone,
        keywords=keywords,
        source_tenant=source_tenant,
        **{f: (data.get(f) or "") for f in MASTER_LEAD_COPY_FIELDS},
    )


def propagate_global_opt_out(*, phone="", email=""):
    q = Q()
    if phone:
        q |= Q(phone_number=phone)
    if email:
        q |= Q(email__iexact=email)
    if not q:
        return
    Lead.objects.filter(q).update(do_not_contact=True)
    MasterLead.objects.filter(q).update(do_not_contact=True)