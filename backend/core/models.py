"""
Core multi-tenant models for the B2B VoIP SaaS & CRM Platform.

Every model except Tenant carries an explicit ForeignKey back to Tenant so that
tenant-scoping (see the TenantModelViewSet in a later phase) can be enforced
consistently at the queryset level.
"""

from decimal import Decimal
from core.phone_utils import normalize_to_e164
from django.contrib.auth.models import AbstractUser
from django.db import models


class Tenant(models.Model):
    class SubscriptionStatus(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        PAID_OVERDUE = "PAID_OVERDUE", "Paid Overdue"
        CANCELLED = "CANCELLED", "Cancelled"

    class BillingMode(models.TextChoices):
        MANUAL = "MANUAL", "Manual"

    company_name = models.CharField(max_length=255)
    subscription_status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
    )
    billing_mode = models.CharField(
        max_length=20,
        choices=BillingMode.choices,
        default=BillingMode.MANUAL,
    )
    last_payment_date = models.DateField(null=True, blank=True)
    subscription_end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name


class Invoice(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="invoices")
    invoice_number = models.CharField(max_length=64, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    due_date = models.DateField()
    is_paid = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-due_date"]

    def __str__(self):
        return f"{self.invoice_number} ({self.tenant.company_name})"


class CustomUser(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin (Boss)"
        AGENT = "AGENT", "Agent (Employee)"

    tenant = models.ForeignKey(
        Tenant, on_delete=models.CASCADE, related_name="users", null=True, blank=True
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.AGENT)

    def __str__(self):
        return f"{self.username} ({self.role})"


class PhoneNumber(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="phone_numbers")
    assigned_user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_numbers",
    )
    phone_number = models.CharField(max_length=32, unique=True)
    telnyx_order_id = models.CharField(max_length=128, blank=True)
    is_active = models.BooleanField(default=True)
    monthly_cost = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("1.00"))
    purchased_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.phone_number:
            self.phone_number = normalize_to_e164(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.phone_number

class Lead(models.Model):
    class Status(models.TextChoices):
        NEW = "NEW", "New"
        CONTACTED = "CONTACTED", "Contacted"
        QUALIFIED = "QUALIFIED", "Qualified"
        WON = "WON", "Won"
        LOST = "LOST", "Lost"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="leads")
    owner = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        help_text="Agent this lead is assigned to; used for per-agent visibility.",
    )
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    job_title = models.CharField(max_length=150, blank=True)
    company = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    deal_value = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    do_not_contact = models.BooleanField(
        default=False,
        help_text="Set automatically when the lead texts STOP/UNSUBSCRIBE/CANCEL.",
    )
    scrape_task = models.ForeignKey(
        "ScrapeTask",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leads",
        help_text="Set when this lead was created by the Agentic Prospector, for per-search lookup.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    contacted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text=(
            "Set the moment someone clicks 'Contact' in the Leads List (or "
            "logs a call/text directly). This is the ONLY thing that makes "
            "a lead appear in the CRM/Dialer tab — the tab stays empty until then."
        ),
    )
    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["tenant", "email"],
                condition=~models.Q(email=""),
                name="unique_tenant_email_when_present",
            ),
            models.UniqueConstraint(
                fields=["tenant", "phone_number"],
                condition=~models.Q(phone_number=""),
                name="unique_tenant_phone_when_present",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.phone_number:
            self.phone_number = normalize_to_e164(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.first_name} {self.last_name} — {self.company}".strip()

class Interaction(models.Model):
    class Type(models.TextChoices):
        CALL = "CALL", "Call"
        SMS = "SMS", "SMS"

    class Direction(models.TextChoices):
        INBOUND = "INBOUND", "Inbound"
        OUTBOUND = "OUTBOUND", "Outbound"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="interactions")
    user = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="interactions"
    )
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name="interactions")
    type = models.CharField(max_length=10, choices=Type.choices)
    direction = models.CharField(max_length=10, choices=Direction.choices)
    phone_number = models.ForeignKey(
        PhoneNumber, on_delete=models.SET_NULL, null=True, blank=True, related_name="interactions"
    )
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    message_body = models.TextField(null=True, blank=True)
    missed = models.BooleanField(
        default=False,
        help_text="True for inbound calls auto-declined due to insufficient wallet balance.",
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.type} {self.direction} — {self.lead}"

class SupportMessage(models.Model):
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="support_messages")
    sender = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="support_messages",
    )
    is_from_platform_owner = models.BooleanField(default=False)
    message = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to="support_attachments/",
        blank=True,
        null=True,
        help_text="Optional proof — e.g. a bank/SadaPay transfer screenshot.",
    )
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]

    def __str__(self):
        who = "Platform Owner" if self.is_from_platform_owner else (self.sender or "Unknown")
        return f"[{self.tenant.company_name}] {who}: {self.message[:40]}"

class ScrapeTask(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="scrape_tasks")
    requested_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="scrape_tasks",
    )
    query = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    existing_count = models.PositiveIntegerField(default=0)
    master_pulled_count = models.PositiveIntegerField(default=0)
    freshly_scraped_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.query} ({self.status})"


class LeadUploadTask(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        COMPLETED = "COMPLETED", "Completed"
        FAILED = "FAILED", "Failed"

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name="lead_upload_tasks")
    requested_by = models.ForeignKey(
        CustomUser, on_delete=models.SET_NULL, null=True, blank=True, related_name="lead_upload_tasks"
    )
    original_filename = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total_rows = models.PositiveIntegerField(default=0)
    created_count = models.PositiveIntegerField(default=0)
    updated_count = models.PositiveIntegerField(default=0)
    error_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    failed_rows = models.JSONField(
        default=list,
        blank=True,
        help_text="List of {row, label, reason} dicts for rows rejected during verification.",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.original_filename} ({self.status})"
    
class MasterLead(models.Model):
    """
    Platform-wide shared pool of VERIFIED leads — never tenant-scoped.
    Populated two ways: (1) every freshly-scraped Prospector result gets
    upserted here too, (2) every bulk-upload row that passes web-presence
    verification gets upserted here too. Random inbound callers/texters are
    NEVER added — only leads a tenant actively found/verified.

    Dedup is global (by email, then phone) — same rule as Lead's per-tenant
    dedup in core.lead_dedup, just without the tenant filter.
    """

    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    job_title = models.CharField(max_length=150, blank=True)
    company = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    website = models.URLField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    keywords = models.CharField(
        max_length=500,
        blank=True,
        help_text="Space-separated search terms this lead matches — powers waterfall lookups.",
    )
    do_not_contact = models.BooleanField(
        default=False,
        help_text="Global opt-out — propagated the instant ANY tenant's copy of this contact texts STOP.",
    )
    source_tenant = models.ForeignKey(
        Tenant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
        help_text="Tenant whose scrape/upload first verified this lead. Informational only — grants no special access.",
    )
    verified_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-verified_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["email"],
                condition=~models.Q(email=""),
                name="unique_master_email_when_present",
            ),
            models.UniqueConstraint(
                fields=["phone_number"],
                condition=~models.Q(phone_number=""),
                name="unique_master_phone_when_present",
            ),
        ]

    def save(self, *args, **kwargs):
        if self.phone_number:
            self.phone_number = normalize_to_e164(self.phone_number)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.company or self.last_name} ({'blocked' if self.do_not_contact else 'active'})"