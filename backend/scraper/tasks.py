import logging

from celery import shared_task

from core.models import Lead, ScrapeTask
from scraper.services import crawl_urls, extract_leads_with_gemini, search_urls

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

            lookup = {"tenant": scrape_task.tenant}
            lookup.update({"email": email} if email else {"phone_number": phone})

            _lead, was_created = Lead.objects.get_or_create(
                **lookup,
                defaults={
                    "first_name": lead_data.get("first_name", ""),
                    "last_name": lead_data.get("last_name", ""),
                    "job_title": lead_data.get("job_title", ""),
                    "company": lead_data.get("company", ""),
                    "phone_number": phone,
                    "website": lead_data.get("website", ""),
                    "status": Lead.Status.NEW,
                    "owner": scrape_task.requested_by,
                    "scrape_task": scrape_task,
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
