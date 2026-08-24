import logging
import os

from celery import shared_task

from core.lead_dedup import find_or_create_lead
from core.models import Lead, LeadUploadTask, ScrapeTask
from scraper.services import crawl_urls, extract_leads_with_gemini, search_urls
from scraper.upload_service import LeadFileParseError, parse_lead_file

logger = logging.getLogger(__name__)


@shared_task(bind=True, rate_limit="10/m")
def run_lead_scrape(self, scrape_task_id):
    """
    rate_limit='10/m' caps how many of these run per minute CLUSTER-WIDE
    (across all workers), independent of the per-user 5/hour API limit on
    ScrapeSearchView — this is what keeps us under Gemini's free-tier ceiling
    even if many tenants queue searches at once.
    """
    try:
        scrape_task = ScrapeTask.objects.select_related("tenant", "requested_by").get(id=scrape_task_id)
    except ScrapeTask.DoesNotExist:
        logger.error("ScrapeTask %s not found", scrape_task_id)
        return

    try:
        urls = search_urls(scrape_task.query)
        scraped_text = crawl_urls(urls)
        leads_data = extract_leads_with_gemini(scraped_text)

        created = 0
        for lead_data in leads_data:
            if not isinstance(lead_data, dict):
                continue

            email = (lead_data.get("email") or "").strip()
            phone = (lead_data.get("phone_number") or "").strip()
            if not email and not phone:
                continue  # nothing to dedupe or contact on — skip

            _lead, was_created = find_or_create_lead(
                tenant=scrape_task.tenant,
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

        scrape_task.status = ScrapeTask.Status.COMPLETED
        scrape_task.save(update_fields=["status"])
        logger.info("ScrapeTask %s completed: %d new leads from %d URLs", scrape_task_id, created, len(urls))

    except Exception:
        logger.exception("ScrapeTask %s failed", scrape_task_id)
        scrape_task.status = ScrapeTask.Status.FAILED
        scrape_task.save(update_fields=["status"])
        raise


@shared_task(bind=True)
def process_lead_upload(self, upload_task_id, file_path):
    """
    Processes one bulk CSV/Excel upload:
      1. Parse the file into rows.
      2. For any row missing BOTH an email and a phone number but that does
         have a website, try a single-page scrape + Gemini extraction on
         that one URL to salvage contact info — this is the "checked and
         tested by the scraper" step, applied only where it's actually
         needed rather than on every row.
      3. Run every row through the same find_or_create_lead dedup logic the
         web scraper uses, so an uploaded list merges into leads that
         already exist instead of duplicating them.
      4. Always deletes the temporary uploaded file when done, success or
         failure, so uploads don't quietly pile up on disk.
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

        for row in rows:
            email = (row.get("email") or "").strip()
            phone = (row.get("phone_number") or "").strip()
            website = (row.get("website") or "").strip()

            if not email and not phone and website:
                # Give the scraper a chance to find contact info from the
                # site itself before giving up on this row.
                try:
                    scraped_text = crawl_urls([website])
                    enriched = extract_leads_with_gemini(scraped_text)
                    if enriched and isinstance(enriched[0], dict):
                        email = email or (enriched[0].get("email") or "").strip()
                        phone = phone or (enriched[0].get("phone_number") or "").strip()
                except Exception:
                    logger.exception("Enrichment scrape failed for %s", website)

            if not email and not phone:
                errors += 1
                continue

            _lead, was_created = find_or_create_lead(
                tenant=upload_task.tenant,
                email=email,
                phone=phone,
                owner=upload_task.requested_by,
                defaults={
                    "first_name": row.get("first_name", ""),
                    "last_name": row.get("last_name", ""),
                    "job_title": row.get("job_title", ""),
                    "company": row.get("company", ""),
                    "website": website,
                    "address": row.get("address", ""),
                    "city": row.get("city", ""),
                    "state": row.get("state", ""),
                    "status": Lead.Status.NEW,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        upload_task.status = LeadUploadTask.Status.COMPLETED
        upload_task.created_count = created
        upload_task.updated_count = updated
        upload_task.error_count = errors
        upload_task.save(update_fields=["status", "total_rows", "created_count", "updated_count", "error_count"])
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