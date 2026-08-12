"""
Base DRF viewset enforcing multi-tenant data isolation.

Every domain viewset (Leads, Interactions, PhoneNumbers, ScrapeTasks, ...) should
subclass TenantModelViewSet instead of rest_framework.viewsets.ModelViewSet directly.

Visibility rules:
- ADMIN (boss): sees every record belonging to their own tenant.
- AGENT (employee): sees only records belonging to their own tenant AND scoped to
  them individually (e.g. their own leads, their own call/SMS logs).

Because different models use different field names for "the user this record
belongs to" (Lead.owner, Interaction.user, ScrapeTask.requested_by,
PhoneNumber.assigned_user), each concrete viewset declares which field to scope
AGENT visibility by via `agent_owner_field`. If a viewset leaves it as None,
AGENT users fall back to full-tenant visibility for that model (appropriate for
something like SupportMessage, where every tenant employee should see the same
thread).
"""

from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from core.models import CustomUser


class TenantModelViewSet(viewsets.ModelViewSet):
    """
    Base ModelViewSet that scopes every queryset to request.user.tenant and
    guarantees new objects are always attached to that same tenant, regardless
    of what the client sends in the request body.
    """

    permission_classes = [IsAuthenticated]

    # Override in subclasses, e.g. agent_owner_field = "owner"
    agent_owner_field = None

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if not user.is_authenticated or user.tenant_id is None:
            return qs.none()

        # Hard tenant boundary — applies to ADMIN and AGENT alike.
        qs = qs.filter(tenant=user.tenant)

        # ADMIN sees all data for their tenant. AGENT is further scoped to
        # only the records that belong to them individually, when the
        # concrete viewset defines an ownership field.
        if user.role == CustomUser.Role.AGENT and self.agent_owner_field:
            qs = qs.filter(**{self.agent_owner_field: user})

        return qs

    def perform_create(self, serializer):
        user = self.request.user

        if not user.is_authenticated or user.tenant_id is None:
            raise PermissionDenied("You must belong to a tenant to create records.")

        # Deliberately ignore any tenant / tenant_id the client may have sent —
        # the tenant is always derived server-side from the authenticated user.
        serializer.validated_data.pop("tenant", None)
        serializer.validated_data.pop("tenant_id", None)

        serializer.save(tenant=user.tenant)

    def perform_update(self, serializer):
        # Prevent an object from being re-parented to a different tenant on update.
        serializer.validated_data.pop("tenant", None)
        serializer.validated_data.pop("tenant_id", None)
        serializer.save()
