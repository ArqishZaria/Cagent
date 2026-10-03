import logging
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
from wallet.services import InsufficientBalance, PlatformFeeOverdue, require_balance, require_platform_fee_current

logger = logging.getLogger(__name__)

ALLOWED_UPLOAD_EXTENSIONS = (".csv", ".xlsx", ".xls")
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB — ~5000 rows of lead data is well under 1 MB

MAX_QUERY_LENGTH = 200
MAX_QUERY_TERMS = 15


def clean_search_query(raw):
    """
    Shared validation for the paid Prospector search and the free
    existing-leads lookup. Returns (query, error_message); exactly one is None/empty.
    Collapses whitespace, and rejects non-string input instead of crashing on .strip().
    """
    raw = raw if isinstance(raw, str) else ""
    query = " ".join(raw.split())
    if not query:
        return "", "query is required."
    if len(query) > MAX_QUERY_LENGTH:
        return "", f"Search is too long — max {MAX_QUERY_LENGTH} characters."
    if len(query.split()) > MAX_QUERY_TERMS:
        return "", f"Search has too many words — max {MAX_QUERY_TERMS}."
    return query, None

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

    Rate-limited to 5 searches per user per hour, gated on the recurring
    platform fee being current, AND gated on wallet balance
    ($0.50/search per PricingRate.Key.LEAD_SEARCH_PER_QUERY) — every check
    happens before the ScrapeTask is even created, so a tenant that can't
    pay never queues (and never gets charged for) a search that can't run.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Rate limit exceeded: max 5 searches per hour."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        query, error = clean_search_query(request.data.get("query"))
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
        try:
            require_platform_fee_current(request.user.tenant)
        except PlatformFeeOverdue as exc:
            return Response(
                {
                    "detail": str(exc),
                    "code": "platform_fee_overdue",
                },
                status=status.HTTP_402_PAYMENT_REQUIRED,
            )

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
        query, error = clean_search_query(request.query_params.get("query"))
        if error:
            return Response({"detail": error}, status=status.HTTP_400_BAD_REQUEST)
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
        return Response(LeadSerializer(leads, many=True, context={"request": request}).data)


@method_decorator(
    ratelimit(key="user", rate="10/h", method="POST", block=False),
    name="post",
)
class LeadUploadView(APIView):
    """
    POST /api/scraper/upload/  (multipart/form-data, field name "file")

    Rate-limited (10/hour per user) and size-capped (5 MB) BEFORE anything is
    written to disk. Row count is enforced during parsing (see
    scraper.upload_service), which never loads more than MAX_ROWS + 1 rows.
    """

    permission_classes = [IsAuthenticated, IsTenantMember]
    parser_classes = [MultiPartParser]

    def post(self, request):
        if getattr(request, "limited", False):
            return Response(
                {"detail": "Upload limit reached: max 10 uploads per hour."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "file is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith(ALLOWED_UPLOAD_EXTENSIONS):
            return Response(
                {"detail": "Please upload a .csv or .xlsx file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_obj.size > MAX_UPLOAD_BYTES:
            return Response(
                {"detail": f"File is too large — max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."},
                status=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )

        upload_dir = os.path.join(settings.BASE_DIR, "lead_uploads")
        os.makedirs(upload_dir, exist_ok=True)
        ext = os.path.splitext(file_obj.name)[1].lower()
        temp_path = os.path.join(upload_dir, f"{uuid.uuid4().hex}{ext}")

        with open(temp_path, "wb") as f:
            for chunk in file_obj.chunks():
                f.write(chunk)

        upload_task = LeadUploadTask.objects.create(
            tenant=request.user.tenant,
            requested_by=request.user,
            original_filename=file_obj.name[:255],
            status=LeadUploadTask.Status.PENDING,
        )

        try:
            process_lead_upload.delay(upload_task.id, temp_path)
        except Exception:
            # Broker (Redis) down — don't leave an orphaned temp file or a
            # task stuck on PENDING forever.
            logger.exception("Couldn't queue LeadUploadTask %s", upload_task.id)
            try:
                os.remove(temp_path)
            except OSError:
                pass
            upload_task.status = LeadUploadTask.Status.FAILED
            upload_task.save(update_fields=["status"])
            return Response(
                {"detail": "Upload service is temporarily unavailable — please try again."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

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