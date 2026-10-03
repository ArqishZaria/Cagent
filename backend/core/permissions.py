"""
DRF permission classes shared across every app.

This module must contain ONLY permission classes. Views and viewsets belong
in their own apps (crm.views, telephony.views, ...); importing them here
would create circular imports.
"""

from rest_framework.permissions import BasePermission

from core.models import CustomUser


class IsTenantMember(BasePermission):
    """Any authenticated user who belongs to a tenant (ADMIN or AGENT)."""

    message = "You must belong to a company account to do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.tenant_id)


class IsTenantAdmin(BasePermission):
    """Authenticated ADMIN (boss) of a tenant. AGENT users get a 403."""

    message = "Only your company's Admin can do this."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.tenant_id
            and user.role == CustomUser.Role.ADMIN
        )