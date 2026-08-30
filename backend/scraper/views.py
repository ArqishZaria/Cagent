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
from wallet.models import PricingRate
from wallet.services import InsufficientBalance, require_balance

ALLOWED_UPLOAD_EXTENSIONS = (".csv", ".xlsx", ".xls")


class ScrapeTaskStatusView(APIView):
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        task = get_object_or_404(ScrapeTask, pk=pk, tenant=request.user.tenant)
        return Response({
            "id": task.id,
            "status": task.status,
            "query": task.query,
            "existing_count": task.existing_count,
            "master_pulled_count": task.master_pulled_count,
            "freshly_scraped_count": task.freshly_scraped_count,
        })

@method_decorator(
    ratelimit(key="user", rate="5/h", method="POST", block=False),
    name="post",
)
class ScrapeSearchView(APIView):
    """
    POST /api/scraper/search/
    Body: {"query": "roofing companies in Austin TX"}

    Rate-limited to 5 searches per user per hour, AND gated on wallet
    balance ($0.50/search per PricingRate.Key.LEAD_SEARCH_PER_QUERY) — the
    balance check happens before the ScrapeTask is even created, so a
    tenant with insufficient funds never queues (and never gets charged
    for) a search that can't run.
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

        cost = PricingRate.get_cost(PricingRate.Key.LEAD_SEARCH_PER_QUERY)
        try:
            require_balance(request.user.tenant, cost)
        except InsufficientBalance as exc:
            return Response(
                {
                    "detail": f"Insufficient wallet balance for a search (need ${exc.required}, have ${exc.available}).",
                    "code": "insufficient_balance",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

        scrape_task = ScrapeTask.objects.create(
            tenant=request.user.tenant,
            requested_by=request.user,
            query=query,
            status=ScrapeTask.Status.PENDING,
        )
        # NOTE: no bill_lead_search() call here anymore — the task bills
        # after it knows whether any leads actually came back.
        run_lead_scrape.delay(scrape_task.id)

        return Response(
            {"id": scrape_task.id, "status": scrape_task.status},
            status=status.HTTP_202_ACCEPTED,
        )


class ExistingLeadsSearchView(APIView):
    """
    GET /api/scraper/existing-leads/?query=roofing austin

    Instant text search against leads already in the tenant's database —
    NOT billed, since it's not the $0.50 web-scrape action, just a local
    DB lookup that runs alongside it (see AgenticProspector.jsx Stage 1).

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
    background processing (scraper.tasks.process_lead_upload). Not billed
    directly — any per-row enrichment scrape inside process_lead_upload
    that hits the same $0-cost pipeline as the Prospector isn't currently
    metered; flag if you want a per-row or per-upload charge added here too.
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
    permission_classes = [IsAuthenticated, IsTenantMember]

    def get(self, request, pk):
        task = get_object_or_404(LeadUploadTask, pk=pk, tenant=request.user.tenant)
        return Response({
            "id": task.id,
            "status": task.status,
            "original_filename": task.original_filename,
            "total_rows": task.total_rows,
            "created_count": task.created_count,
            "updated_count": task.updated_count,
            "error_count": task.error_count,
            "failed_rows": task.failed_rows,
        })