from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import ScrapeTask
from core.permissions import IsTenantMember
from scraper.tasks import run_lead_scrape


class ScrapeTaskStatusView(APIView):
    """
    GET /api/scraper/tasks/<id>/

    Polled by the Agentic Prospector UI until status flips to COMPLETED or
    FAILED. Tenant-scoped — a task belonging to another tenant 404s rather
    than leaking its existence.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        task = get_object_or_404(ScrapeTask, pk=pk, tenant=request.user.tenant)
        return Response({"id": task.id, "status": task.status, "query": task.query})


@method_decorator(
    ratelimit(key="user", rate="5/h", method="POST", block=False),
    name="post",
)
class ScrapeSearchView(APIView):
    """
    POST /api/scraper/search/
    Body: {"query": "roofing companies in Austin TX"}

    Rate-limited to 5 searches per user per hour. block=False (rather than
    letting django-ratelimit raise) so we control the response shape and
    return a clean 429 instead of an unhandled exception.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Rate limit exceeded: max 5 searches per hour."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        query = (request.data.get("query") or "").strip()
        if not query:
            return Response({"detail": "query is required."}, status=status.HTTP_400_BAD_REQUEST)

        scrape_task = ScrapeTask.objects.create(
            tenant=request.user.tenant,
            requested_by=request.user,
            query=query,
            status=ScrapeTask.Status.PENDING,
        )
        run_lead_scrape.delay(scrape_task.id)

        return Response(
            {"id": scrape_task.id, "status": scrape_task.status},
            status=status.HTTP_202_ACCEPTED,
        )
