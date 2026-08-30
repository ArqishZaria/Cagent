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
    """
    The search waterfall, run server-side so the flat $0.50 fee (already
    charged in scraper.views.ScrapeSearchView before this task was queued)
    always covers the whole process regardless of which stage fills the
    quota:
      1. Count matches already in the tenant's own Lead list.
      2. Pull remaining quota for free from the shared Master pool.
      3. Whatever's still missing gets a fresh web scrape — and every
         freshly scraped lead is verified into the Master pool too, so the
         next tenant who searches something similar gets it for free.
    """
    try:
        scrape_task = ScrapeTask.objects.select_related("tenant", "requested_by").get(id=scrape_task_id)
    except ScrapeTask.DoesNotExist:
        logger.error("ScrapeTask %s not found", scrape_task_id)
        return

    tenant = scrape_task.tenant
    query = scrape_task.query

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

        scrape_task.status = ScrapeTask.Status.COMPLETED
        scrape_task.existing_count = existing_count
        scrape_task.master_pulled_count = len(master_pulled)
        scrape_task.freshly_scraped_count = created
        scrape_task.save(update_fields=[
            "status", "existing_count", "master_pulled_count", "freshly_scraped_count",
        ])

        total_returned = existing_count + len(master_pulled) + created
        bill_lead_search(tenant, scrape_task, total_returned)

        logger.info(
            "ScrapeTask %s completed: %d existing, %d from master, %d freshly scraped (quota %d)",
            scrape_task_id, existing_count, len(master_pulled), created, LEAD_QUOTA,
        )

    except Exception:
        logger.exception("ScrapeTask %s failed", scrape_task_id)
        scrape_task.status = ScrapeTask.Status.FAILED
        scrape_task.save(update_fields=["status"])
        raise


@shared_task(bind=True)
def process_lead_upload(self, upload_task_id, file_path):
    """
    Bulk upload, now with verification + Master DB routing:
      1. Parse the file.
      2. Rows with no email/phone but a website get an enrichment scrape
         (unchanged from before).
      3. Rows that STILL have no contact info are rejected outright.
      4. Rows WITH contact info but no website get a lightweight web-presence
         check (verify_lead_has_web_presence) — no web presence = rejected,
         with a reason recorded in failed_rows for the tenant to review.
      5. Everything that passes is dedup-merged into the tenant's Lead list
         AND upserted into the shared Master pool.
    """
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

            has_contact = bool(email or phone)

            if not has_contact and website:
                try:
                    scraped_text = crawl_urls([website])
                    enriched = extract_leads_with_gemini(scraped_text)
                    if enriched and isinstance(enriched[0], dict):
                        email = email or (enriched[0].get("email") or "").strip()
                        phone = phone or (enriched[0].get("phone_number") or "").strip()
                        has_contact = bool(email or phone)
                except Exception:
                    logger.exception("Enrichment scrape failed for %s", website)

            if not has_contact:
                errors += 1
                failed_rows.append({"row": i, "label": label, "reason": "No email or phone number found."})
                continue

            if not website:
                found, _text = verify_lead_has_web_presence(row)
                if not found:
                    errors += 1
                    failed_rows.append({"row": i, "label": label, "reason": "No web presence found — couldn't verify."})
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

            upsert_master_lead(
                {**lead_defaults, "email": email, "phone_number": phone},
                query=f"{row.get('company', '')} {row.get('city', '')} {row.get('state', '')}",
                source_tenant=upload_task.tenant,
            )

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