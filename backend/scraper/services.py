"""
The $0 lead-generation pipeline:
  1. duckduckgo-search finds candidate URLs for the user's query (no API key,
     no cost).
  2. crawl4ai (Playwright/Chromium under the hood) fetches and renders each
     page, returning clean markdown.
  3. Gemini 2.5 Flash (free tier) reads the combined text and extracts
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
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

genai.configure(api_key=settings.GEMINI_API_KEY)

SEARCH_RESULT_LIMIT = 5
MAX_CRAWL_CHARS_PER_PAGE = 6000  # keeps the Gemini prompt a sane size across ~5 pages

EXTRACTION_PROMPT = """You are a B2B lead-extraction engine. Read the source content below \
(scraped from multiple web pages) and extract every distinct person or company contact you \
can find who looks like a plausible sales lead.

Return ONLY a JSON array (no markdown fences, no commentary) of objects with exactly these keys:
first_name, last_name, job_title, company, phone_number, email, website.

Use an empty string "" for any field you cannot determine. If you find no leads, return [].

SOURCE CONTENT:
{content}
"""


def search_urls(query: str, limit: int = SEARCH_RESULT_LIMIT) -> list[str]:
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=limit))
    return [r["href"] for r in results if r.get("href")]


async def _crawl_urls_async(urls: list[str]) -> str:
    sections = []
    async with AsyncWebCrawler() as crawler:
        for url in urls:
            try:
                result = await crawler.arun(url=url)
                text = (getattr(result, "markdown", "") or "")[:MAX_CRAWL_CHARS_PER_PAGE]
                if text.strip():
                    sections.append(f"--- SOURCE: {url} ---\n{text}")
            except Exception:
                logger.exception("crawl4ai failed for %s", url)
    return "\n\n".join(sections)


def crawl_urls(urls: list[str]) -> str:
    """
    Celery tasks run in a plain sync context; crawl4ai's AsyncWebCrawler is
    async (it drives Playwright), so we spin up a fresh event loop with
    asyncio.run() here rather than requiring the whole task to be async.
    """
    if not urls:
        return ""
    return asyncio.run(_crawl_urls_async(urls))


def extract_leads_with_gemini(scraped_text: str) -> list[dict]:
    if not scraped_text.strip():
        return []

    model = genai.GenerativeModel("gemini-2.5-flash")
    response = model.generate_content(EXTRACTION_PROMPT.format(content=scraped_text))

    raw = (response.text or "").strip()
    # Gemini occasionally wraps output in ```json ... ``` despite instructions not to.
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
