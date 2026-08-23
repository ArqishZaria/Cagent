"""
The $0 lead-generation pipeline:
  1. ddgs finds candidate URLs for the user's query (no API key, no cost).
  2. crawl4ai (Playwright/Chromium under the hood) fetches and renders each
     page CONCURRENTLY (a handful at a time), returning clean markdown.
  3. Gemini (Pro-with-Flash-fallback) reads the combined text and extracts
     structured lead JSON.

Kept as plain functions (not classes) so scraper.tasks.run_lead_scrape can
call each stage independently and log/handle failures per-stage.
"""

import asyncio
import json
import logging

import google.generativeai as genai
from crawl4ai import AsyncWebCrawler
from django.conf import settings
from ddgs import DDGS
from google.api_core.exceptions import ResourceExhausted

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)

# Raised from 5 -> 20: more candidate sites per search means more leads make
# it through, even though a good fraction of any batch will be blocked by
# anti-bot protection on larger directory sites (Yelp, Angi, BBB, etc.) —
# that's a real limitation of public web scraping, not something more code
# can route around.
SEARCH_RESULT_LIMIT = 20
MAX_CRAWL_CHARS_PER_PAGE = 6000  # keeps the Gemini prompt a sane size across many pages
CRAWL_CONCURRENCY = 5  # how many pages crawl4ai renders at once, not sequentially

GEMINI_MODEL_PRIORITY = ("gemini-3.1-pro-preview", "gemini-3.6-flash")

EXTRACTION_PROMPT = """You are a B2B lead-extraction engine. Read the source content below \
(scraped from multiple web pages) and extract every distinct person or company contact you \
can find who looks like a plausible sales lead.

Return ONLY a JSON array (no markdown fences, no commentary) of objects with exactly these keys:
first_name, last_name, job_title, company, phone_number, email, website, address, city, state.

Use an empty string "" for any field you cannot determine. If you find no leads, return [].

SOURCE CONTENT:
{content}
"""


def search_urls(query: str, limit: int = SEARCH_RESULT_LIMIT) -> list[str]:
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=limit))
    return [r["href"] for r in results if r.get("href")]


async def _crawl_urls_async(urls: list[str]) -> str:
    if not urls:
        return ""

    semaphore = asyncio.Semaphore(CRAWL_CONCURRENCY)

    async def crawl_one(crawler, url):
        async with semaphore:
            try:
                result = await crawler.arun(url=url)
                text = (getattr(result, "markdown", "") or "")[:MAX_CRAWL_CHARS_PER_PAGE]
                if text.strip():
                    return f"--- SOURCE: {url} ---\n{text}"
            except Exception:
                logger.exception("crawl4ai failed for %s", url)
            return None

    async with AsyncWebCrawler() as crawler:
        results = await asyncio.gather(*(crawl_one(crawler, url) for url in urls))

    return "\n\n".join(r for r in results if r)


def crawl_urls(urls: list[str]) -> str:
    """
    Celery tasks run in a plain sync context; crawl4ai's AsyncWebCrawler is
    async (it drives Playwright), so we spin up a fresh event loop with
    asyncio.run() here rather than requiring the whole task to be async.
    Pages are now crawled CRAWL_CONCURRENCY at a time instead of one at a
    time, so raising SEARCH_RESULT_LIMIT doesn't multiply wall-clock time
    by the same factor.
    """
    if not urls:
        return ""
    return asyncio.run(_crawl_urls_async(urls))


def extract_leads_with_gemini(scraped_text: str) -> list[dict]:
    if not scraped_text.strip():
        return []

    prompt = EXTRACTION_PROMPT.format(content=scraped_text)
    response = None

    for model_name in GEMINI_MODEL_PRIORITY:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            logger.info("Lead extraction succeeded using %s", model_name)
            break
        except ResourceExhausted:
            logger.warning("%s quota exhausted right now, trying next model", model_name)
            continue
        except Exception:
            logger.exception("Gemini call failed on %s", model_name)
            continue

    if response is None:
        logger.error("All Gemini models failed or were rate-limited this run")
        return []

    raw = (response.text or "").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]

    try:
        leads = json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Gemini did not return valid JSON (first 500 chars): %s", raw[:500])
        return []

    return leads if isinstance(leads, list) else []