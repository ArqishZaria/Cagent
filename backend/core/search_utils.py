"""Shared keyword-matching helper — same OR-across-fields pattern used by
the CRM's lead search box, the Prospector's tenant-DB check, and the
Master pool waterfall lookup, so all three "search" experiences behave
consistently."""

from django.db.models import Q


def keyword_filter(fields, query):
    """
    Builds a Q object matching ANY of `fields` containing ANY term from
    `query` (case-insensitive). Empty query returns an empty (all-match) Q.
    """
    q_filter = Q()
    for term in (query or "").split():
        for field in fields:
            q_filter |= Q(**{f"{field}__icontains": term})
    return q_filter