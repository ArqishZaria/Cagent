from django.db.models import Q

MAX_TERMS = 15


def keyword_filter(fields, query):
    """
    Builds a Q object matching ANY of `fields` containing ANY term from
    `query` (case-insensitive). Only the first MAX_TERMS terms are used, so a
    huge query can't generate an enormous OR-expression. Empty query returns
    an empty (all-match) Q.
    """
    q_filter = Q()
    for term in (query or "").split()[:MAX_TERMS]:
        for field in fields:
            q_filter |= Q(**{f"{field}__icontains": term})
    return q_filter