import os
import uuid

from django.conf import settings
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django_ratelimit.decorators import ratelimit
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import CustomUser, Lead, LeadUploadTask, ScrapeTask
from core.permissions import IsTenantMember
from crm.serializers import LeadSerializer
from scraper.tasks import process_lead_upload, run_lead_scrape

ALLOWED_UPLOAD_EXTENSIONS = (".csv", ".xlsx", ".xls")


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


class ExistingLeadsSearchView(APIView):
    """
    GET /api/scraper/existing-leads/?query=roofing austin

    Instant text search across the tenant's OWN lead database — called
    right when a Prospector search is submitted, so leads already found in
    a past search show up immediately, before (and independent of) the
    slower background web scrape for anything new.

    Ownership rule matches the rest of the CRM (LeadViewSet): an AGENT only
    sees their own leads here (what they personally found or uploaded); an
    ADMIN sees the tenant's combined list, everyone's leads together.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request):
        query = (request.query_params.get("query") or "").strip()
        if not query:
            return Response({"detail": "query is required."}, status=status.HTTP_400_BAD_REQUEST)

        q_filter = Q()
        for term in query.split():
            q_filter |= (
                Q(company__icontains=term)
                | Q(city__icontains=term)
                | Q(state__icontains=term)
                | Q(job_title__icontains=term)
                | Q(first_name__icontains=term)
                | Q(last_name__icontains=term)
            )

        leads = Lead.objects.filter(tenant=request.user.tenant).filter(q_filter)
        if request.user.role == CustomUser.Role.AGENT:
            leads = leads.filter(owner=request.user)

        leads = leads.order_by("-created_at")[:50]
        return Response(LeadSerializer(leads, many=True).data)


class LeadUploadView(APIView):
    """
    POST /api/scraper/upload/  (multipart/form-data, field name "file")

    Accepts a .csv or .xlsx file, saves it to a temp folder, and queues
    background processing (scraper.tasks.process_lead_upload) — the same
    "kick off a background job, poll for status" pattern as the web
    scraper, since a large spreadsheet shouldn't make the request wait.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith(ALLOWED_UPLOAD_EXTENSIONS):
            return Response(
                {"detail": "Please upload a .csv or .xlsx file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        upload_dir = os.path.join(settings.BASE_DIR, "lead_uploads")
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(file_obj.name)[1]
        temp_path = os.path.join(upload_dir, f"{uuid.uuid4().hex}{ext}")

        with open(temp_path, "wb") as f:
            for chunk in file_obj.chunks():
                f.write(chunk)

        upload_task = LeadUploadTask.objects.create(
            tenant=request.user.tenant,
            requested_by=request.user,
            original_filename=file_obj.name,
            status=LeadUploadTask.Status.PENDING,
        )
        process_lead_upload.delay(upload_task.id, temp_path)

        return Response(
            {"id": upload_task.id, "status": upload_task.status},
            status=status.HTTP_202_ACCEPTED,
        )


class LeadUploadStatusView(APIView):
    """GET /api/scraper/upload-tasks/<id>/ — polled until COMPLETED or FAILED."""

    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        task = get_object_or_404(LeadUploadTask, pk=pk, tenant=request.user.tenant)
        return Response(
            {
                "id": task.id,
                "status": task.status,
                "original_filename": task.original_filename,
                "total_rows": task.total_rows,
                "created_count": task.created_count,
                "updated_count": task.updated_count,
                "error_count": task.error_count,
            }
        )