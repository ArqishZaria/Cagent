"""
Advanced Django admin — the platform owner's main control center.

Every model is registered with list_display / search_fields / list_filter /
readonly_fields. Tenant shows its Invoices and PhoneNumbers inline. Invoice has
a "Mark Invoice as Paid" action that also reactivates the tenant's subscription.
"""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count
from django.utils import timezone
from django.utils.translation import ngettext

from core.models import (
    CustomUser,
    Interaction,
    Invoice,
    Lead,
    MasterLead,
    PhoneNumber,
    ScrapeTask,
    SupportMessage,
    Tenant,
)


# ------------------------------------------------------------------------------------
# Tenant + inlines (Invoices, Phone Numbers)
# ------------------------------------------------------------------------------------


class InvoiceInline(admin.TabularInline):
    model = Invoice
    extra = 0
    fields = ("invoice_number", "amount", "due_date", "is_paid")
    readonly_fields = ("invoice_number", "amount", "due_date")
    show_change_link = True


class PhoneNumberInline(admin.TabularInline):
    model = PhoneNumber
    extra = 0
    fields = ("phone_number", "assigned_user", "telnyx_order_id", "is_active")
    readonly_fields = ("telnyx_order_id",)
    show_change_link = True

@admin.register(MasterLead)
class MasterLeadAdmin(admin.ModelAdmin):
    list_display = ("company", "last_name", "city", "state", "phone_number", "email", "do_not_contact", "source_tenant", "verified_at")
    list_filter = ("do_not_contact", "state")
    search_fields = ("company", "first_name", "last_name", "phone_number", "email", "keywords")
    readonly_fields = ("verified_at", "updated_at")
    
@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = (
        "company_name",
        "subscription_status",
        "billing_mode",
        "last_payment_date",
        "subscription_end_date",
        "created_at",
    )
    list_filter = ("subscription_status", "billing_mode")
    search_fields = ("company_name",)
    readonly_fields = ("created_at",)
    inlines = [InvoiceInline, PhoneNumberInline]


# ------------------------------------------------------------------------------------
# Invoice — with "Mark Invoice as Paid" action
# ------------------------------------------------------------------------------------


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "tenant", "amount", "due_date", "is_paid", "created_at")
    list_filter = ("is_paid", "due_date", "tenant")
    search_fields = ("invoice_number", "tenant__company_name")
    readonly_fields = ("created_at",)
    actions = ["mark_invoice_as_paid"]

    @admin.action(description="Mark selected invoices as paid & reactivate tenant")
    def mark_invoice_as_paid(self, request, queryset):
        updated = 0
        for invoice in queryset.select_related("tenant"):
            invoice.is_paid = True
            invoice.save(update_fields=["is_paid"])

            tenant = invoice.tenant
            tenant.subscription_status = Tenant.SubscriptionStatus.ACTIVE
            tenant.last_payment_date = timezone.now().date()

            base_date = tenant.subscription_end_date
            if not base_date or base_date < timezone.now().date():
                base_date = timezone.now().date()
            tenant.subscription_end_date = base_date + timezone.timedelta(days=30)
            tenant.save(update_fields=["subscription_status", "last_payment_date", "subscription_end_date"])

            updated += 1

        self.message_user(
            request,
            ngettext(
                "%d invoice was marked paid and its tenant reactivated.",
                "%d invoices were marked paid and their tenants reactivated.",
                updated,
            )
            % updated,
            messages.SUCCESS,
        )


# ------------------------------------------------------------------------------------
# Users — role assignment + moving between tenants
# ------------------------------------------------------------------------------------


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "tenant", "role", "is_active", "is_staff")
    list_filter = ("role", "tenant", "is_active", "is_staff")
    search_fields = ("username", "email", "first_name", "last_name", "tenant__company_name")
    list_editable = ("role",)

    fieldsets = UserAdmin.fieldsets + (
        ("Tenant & Role", {"fields": ("tenant", "role")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Tenant & Role", {"fields": ("tenant", "role")}),
    )


# ------------------------------------------------------------------------------------
# Phone Numbers
# ------------------------------------------------------------------------------------


@admin.register(PhoneNumber)
class PhoneNumberAdmin(admin.ModelAdmin):
    list_display = ("phone_number", "tenant", "assigned_user", "monthly_cost", "is_active", "purchased_at")
    list_filter = ("is_active", "tenant")
    search_fields = ("phone_number", "telnyx_order_id", "tenant__company_name")
    readonly_fields = ("telnyx_order_id", "purchased_at")


# ------------------------------------------------------------------------------------
# Leads — searchable by company / phone
# ------------------------------------------------------------------------------------


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "company",
        "city",
        "state",
        "phone_number",
        "status",
        "deal_value",
        "owner",
        "tenant",
        "do_not_contact",
        "scrape_task",
        "updated_at",
    )
    list_filter = ("status", "do_not_contact", "tenant")
    search_fields = ("first_name", "last_name", "company", "phone_number", "email")
    readonly_fields = ("created_at", "updated_at")

    @admin.display(description="Name")
    def full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or "—"


# ------------------------------------------------------------------------------------
# Interactions (call / SMS logs)
# ------------------------------------------------------------------------------------


@admin.register(Interaction)
class InteractionAdmin(admin.ModelAdmin):
    list_display = ("lead", "user", "tenant", "type", "direction", "duration_seconds", "timestamp")
    list_filter = ("type", "direction", "tenant")
    search_fields = ("lead__first_name", "lead__last_name", "lead__company", "message_body", "notes")
    readonly_fields = ("timestamp",)


# ------------------------------------------------------------------------------------
# Support chat — platform owner can view / reply / edit any message
# ------------------------------------------------------------------------------------


@admin.register(SupportMessage)
class SupportMessageAdmin(admin.ModelAdmin):
    list_display = ("tenant", "sender", "is_from_platform_owner", "short_message", "timestamp")
    list_filter = ("tenant", "is_from_platform_owner", "timestamp")
    search_fields = ("message", "tenant__company_name", "sender__username")
    readonly_fields = ("timestamp",)
    fields = ("tenant", "sender", "is_from_platform_owner", "message", "timestamp")

    @admin.display(description="Message")
    def short_message(self, obj):
        return (obj.message[:60] + "…") if len(obj.message) > 60 else obj.message


# ------------------------------------------------------------------------------------
# Scrape Tasks — success / fail visibility
# ------------------------------------------------------------------------------------


@admin.register(ScrapeTask)
class ScrapeTaskAdmin(admin.ModelAdmin):
    list_display = ("query", "tenant", "requested_by", "status", "created_at")
    list_filter = ("status", "tenant")
    search_fields = ("query", "tenant__company_name")
    readonly_fields = ("created_at",)

    def changelist_view(self, request, extra_context=None):
        stats = self.get_queryset(request).values("status").annotate(count=Count("id"))
        counts = {row["status"]: row["count"] for row in stats}
        total = sum(counts.values())

        if total:
            completed = counts.get(ScrapeTask.Status.COMPLETED, 0)
            failed = counts.get(ScrapeTask.Status.FAILED, 0)
            pending = counts.get(ScrapeTask.Status.PENDING, 0)
            success_rate = (completed / total) * 100
            self.message_user(
                request,
                (
                    f"Scrape tasks — total: {total}, completed: {completed}, "
                    f"failed: {failed}, pending: {pending}, success rate: {success_rate:.1f}%."
                ),
                messages.INFO,
            )

        return super().changelist_view(request, extra_context=extra_context)