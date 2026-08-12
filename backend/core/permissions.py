"""
Shared permission classes. Kept in core/ since both `users` and `telephony`
(and later `billing`/`scraper`/`support`) need the same ADMIN-vs-AGENT checks.
"""

from rest_framework.permissions import BasePermission

from core.models import CustomUser


class IsTenantAdmin(BasePermission):
    """
    Allows access only to authenticated users with role=ADMIN who belong to a
    tenant. AGENT users get a 403, matching the spec's "Block AGENT users from
    this endpoint" requirement.
    """

    message = "Only tenant admins can perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.tenant_id is not None
            and user.role == CustomUser.Role.ADMIN
        )


class IsTenantMember(BasePermission):
    """Any authenticated user who belongs to a tenant (ADMIN or AGENT)."""

    message = "You must belong to a tenant to perform this action."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.tenant_id is not None)
