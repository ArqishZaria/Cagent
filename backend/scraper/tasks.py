import logging
import os

from celery import shared_task

from core.lead_dedup import find_or_create_lead
from core.master_lead import count_existing_tenant_matches, pull_from_master, upsert_master_lead
from core.models import Lead, LeadUploadTask, ScrapeTask
from wallet.services import bill_lead_search
from scraper.services import (
    SEARCH_RESULT_LIMIT,
    crawl_urls,
    extract_leads_with_gemini,
    search_urls,
    verify_lead_has_web_presence,
)
from scraper.upload_service import LeadFileParseError, parse_lead_file

logger = logging.getLogger(__name__)

LEAD_QUOTA = 25  # every search waterfall fills to this, across all three stages


@shared_task(bind=True, rate_limit="10/m")
def run_lead_scrape(self, scrape_task_id):
    try:
        scrape_task = ScrapeTask.objects.select_related("tenant", "requested_by").get(id=scrape_task_id)
    except ScrapeTask.DoesNotExist:
        logger.error("ScrapeTask %s not found", scrape_task_id)
        return

    tenant = scrape_task.tenant
    query = scrape_task.query

    # This block covers ONLY the lead-finding work itself. If anything in
    # here throws, the search genuinely failed and FAILED is the correct
    # status — unchanged from before.
    try:
        existing_count = count_existing_tenant_matches(tenant, query)
        remaining = max(0, LEAD_QUOTA - existing_count)

        master_pulled = []
        if remaining:
            master_pulled = pull_from_master(
                tenant, query, remaining, owner=scrape_task.requested_by, scrape_task=scrape_task
            )
            remaining -= len(master_pulled)

        created = 0
        if remaining:
            urls = search_urls(query, limit=min(SEARCH_RESULT_LIMIT, max(remaining * 2, 5)))
            scraped_text = crawl_urls(urls)
            leads_data = extract_leads_with_gemini(scraped_text)

            for lead_data in leads_data:
                if remaining <= 0:
                    break
                if not isinstance(lead_data, dict):
                    continue

                email = (lead_data.get("email") or "").strip()
                phone = (lead_data.get("phone_number") or "").strip()
                if not email and not phone:
                    continue

                _lead, was_created = find_or_create_lead(
                    tenant=tenant,
                    email=email,
                    phone=phone,
                    owner=scrape_task.requested_by,
                    scrape_task=scrape_task,
                    defaults={
                        "first_name": lead_data.get("first_name", ""),
                        "last_name": lead_data.get("last_name", ""),
                        "job_title": lead_data.get("job_title", ""),
                        "company": lead_data.get("company", ""),
                        "website": lead_data.get("website", ""),
                        "address": lead_data.get("address", ""),
                        "city": lead_data.get("city", ""),
                        "state": lead_data.get("state", ""),
                        "status": Lead.Status.NEW,
                    },
                )
                if was_created:
                    created += 1
                    remaining -= 1
                    upsert_master_lead(lead_data, query=query, source_tenant=tenant)
    except Exception:
        logger.exception("ScrapeTask %s failed", scrape_task_id)
        scrape_task.status = ScrapeTask.Status.FAILED
        scrape_task.save(update_fields=["status"])
        raise

    # Everything above succeeded — the leads are real and saved. From here
    # on, the task is COMPLETED no matter what happens next. Billing is a
    # separate concern from "did the search work," and must never
    # retroactively flip a genuinely successful search back to FAILED —
    # that previously hid real, already-created leads from the tenant.
    scrape_task.status = ScrapeTask.Status.COMPLETED
    scrape_task.existing_count = existing_count
    scrape_task.master_pulled_count = len(master_pulled)
    scrape_task.freshly_scraped_count = created
    scrape_task.save(update_fields=[
        "status", "existing_count", "master_pulled_count", "freshly_scraped_count",
    ])

    newly_added = len(master_pulled) + created
    try:
        bill_lead_search(tenant, scrape_task, newly_added)
    except Exception:
        # A billing failure here must NEVER touch scrape_task.status. Log
        # loudly (this repo's LOGGING config already routes scraper.* at
        # INFO to console/gunicorn-error.log, so this surfaces in ops
        # monitoring) rather than silently losing the charge. The most
        # likely real trigger is a missing/deactivated PricingRate row —
        # PricingRate.get_cost() raises ValueError precisely in that case
        # — which is fixed in the admin panel, not by mislabeling
        # completed work as failed.
        logger.exception(
            "ScrapeTask %s completed successfully but billing FAILED — tenant %s "
            "was NOT charged for %d leads. Needs manual reconciliation.",
            scrape_task_id, tenant.company_name, newly_added,
        )

    logger.info(
        "ScrapeTask %s completed: %d existing, %d from master, %d freshly scraped (quota %d)",
        scrape_task_id, existing_count, len(master_pulled), created, LEAD_QUOTA,
    )

@shared_task(bind=True)
def process_lead_upload(self, upload_task_id, file_path):
    """
    Bulk upload — simplified: every row with an email or phone number is
    added straight to the tenant's own Lead list via find_or_create_lead.
    No scraping, no verification, and no Master DB promotion happens here
    — uploading is free and instant. Rows with neither an email nor a
    phone number are rejected outright (nothing to dedupe/contact on).

    Promoting a tenant's uploaded leads into the shared Master DB is a
    separate, manual step: select the leads in Django admin and run the
    "Verify web presence & queue for Master DB" action (see
    verify_and_promote_leads below and core.admin.LeadAdmin) — that's the
    only place this scrape now runs, and it's never billed either; it's
    Arqish personally deciding what's worth reusing across clients.

    The uploaded temp file at file_path is always removed before this task
    exits, on every exit path — including the early return below when the
    LeadUploadTask row itself can't be found — via the outer try/finally.
    """
    try:
        try:
            upload_task = LeadUploadTask.objects.select_related("tenant", "requested_by").get(id=upload_task_id)
        except LeadUploadTask.DoesNotExist:
            logger.error("LeadUploadTask %s not found", upload_task_id)
            return

        try:
            rows = parse_lead_file(file_path)
            upload_task.total_rows = len(rows)

            created = updated = errors = 0
            failed_rows = []

            for i, row in enumerate(rows, start=1):
                email = (row.get("email") or "").strip()
                phone = (row.get("phone_number") or "").strip()
                website = (row.get("website") or "").strip()
                label = row.get("company") or f"{row.get('first_name', '')} {row.get('last_name', '')}".strip() or f"row {i}"

                if not email and not phone:
                    errors += 1
                    failed_rows.append({"row": i, "label": label, "reason": "No email or phone number found."})
                    continue

                lead_defaults = {
                    "first_name": row.get("first_name", ""),
                    "last_name": row.get("last_name", ""),
                    "job_title": row.get("job_title", ""),
                    "company": row.get("company", ""),
                    "website": website,
                    "address": row.get("address", ""),
                    "city": row.get("city", ""),
                    "state": row.get("state", ""),
                    "status": Lead.Status.NEW,
                }

                _lead, was_created = find_or_create_lead(
                    tenant=upload_task.tenant,
                    email=email,
                    phone=phone,
                    owner=upload_task.requested_by,
                    defaults=lead_defaults,
                )
                if was_created:
                    created += 1
                else:
                    updated += 1

            upload_task.status = LeadUploadTask.Status.COMPLETED
            upload_task.created_count = created
            upload_task.updated_count = updated
            upload_task.error_count = errors
            upload_task.failed_rows = failed_rows
            upload_task.save(update_fields=[
                "status", "total_rows", "created_count", "updated_count", "error_count", "failed_rows",
            ])
            logger.info(
                "LeadUploadTask %s completed: %d created, %d updated, %d errors",
                upload_task_id, created, updated, errors,
            )

        except LeadFileParseError as exc:
            logger.warning("LeadUploadTask %s parse error: %s", upload_task_id, exc)
            upload_task.status = LeadUploadTask.Status.FAILED
            upload_task.save(update_fields=["status"])
        except Exception:
            logger.exception("LeadUploadTask %s failed", upload_task_id)
            upload_task.status = LeadUploadTask.Status.FAILED
            upload_task.save(update_fields=["status"])
            raise
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except OSError:
            logger.exception("Couldn't remove temp upload file %s", file_path)
            
@shared_task(bind=True)
def verify_and_promote_leads(self, lead_ids):
    """
    Manually triggered from Django admin (see core.admin.LeadAdmin's
    "Verify web presence & queue for Master DB" action) — never automatic,
    never billed. Arqish selects leads he's personally vetted are worth
    reusing across clients; this runs the same web-presence check the old
    automatic upload flow used (verify_lead_has_web_presence), and
    anything that still has a real web presence gets upserted into the
    shared MasterLead pool. Leads that fail the check are simply left
    alone — not deleted, not flagged, just not promoted.
    """
    leads = Lead.objects.filter(id__in=lead_ids).select_related("tenant")
    promoted = skipped = 0

    for lead in leads:
        row = {
            "first_name": lead.first_name,
            "last_name": lead.last_name,
            "job_title": lead.job_title,
            "company": lead.company,
            "phone_number": lead.phone_number,
            "email": lead.email,
            "website": lead.website,
            "address": lead.address,
            "city": lead.city,
            "state": lead.state,
        }
        try:
            found, _text = verify_lead_has_web_presence(row)
        except Exception:
            logger.exception("Master DB verification failed for lead %s — leaving unpromoted.", lead.id)
            skipped += 1
            continue

        if found:
            upsert_master_lead(
                row,
                query=f"{lead.company} {lead.city} {lead.state}".strip(),
                source_tenant=lead.tenant,
            )
            promoted += 1
        else:
            skipped += 1

    logger.info(
        "verify_and_promote_leads: %d promoted, %d skipped (no web presence) out of %d selected",
        promoted, skipped, len(lead_ids),
    )
    return {"promoted": promoted, "skipped": skipped}