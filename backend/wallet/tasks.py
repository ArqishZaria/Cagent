"""
Celery-beat: monthly recurring Telnyx costs (number rental, SMS capability,
10DLC fee) get deducted from the wallet the same way call/SMS usage does —
one WalletTransaction per number per month, so it shows up in the Track
Finances breakdown just like everything else.
"""

import logging

from celery import shared_task
from core.models import PhoneNumber, Tenant
from wallet.models import PricingRate, WalletTransaction
from wallet.services import bill_usage, try_charge_platform_fee
from django.utils import timezone
from core.models import PhoneNumber
from wallet.models import PricingRate, WalletTransaction
from wallet.services import bill_usage

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def charge_monthly_number_rentals(self):
    rental_cost = PricingRate.get_cost(PricingRate.Key.NUMBER_MONTHLY_RENTAL)
    sms_fee = PricingRate.get_cost(PricingRate.Key.NUMBER_SMS_CAPABILITY_FEE)

    charged = 0
    for number in PhoneNumber.objects.filter(is_active=True).select_related("tenant"):
        try:
            bill_usage(
                number.tenant,
                type=WalletTransaction.Type.USAGE_NUMBER_RENTAL,
                cost_usd=rental_cost + sms_fee,
                description=f"Monthly rental — {number.phone_number}",
                related_phone_number=number,
            )
            charged += 1
        except Exception:
            logger.exception("Failed to charge monthly rental for number %s", number.phone_number)

    logger.info("charge_monthly_number_rentals: charged %d/%d numbers", charged, PhoneNumber.objects.filter(is_active=True).count())
    return charged


@shared_task(bind=True)
def charge_platform_fees(self):
    """
    Daily sweep — unlike charge_monthly_number_rentals (fixed 1st-of-month),
    platform fees are due on a rolling per-tenant anniversary
    (next_platform_fee_charge_at), so every tenant has to be checked daily
    against their own due date.
    """
    due_tenants = Tenant.objects.filter(
        next_platform_fee_charge_at__lte=timezone.now(),
    ).exclude(subscription_status=Tenant.SubscriptionStatus.CANCELLED)

    charged = overdue = 0
    for tenant in due_tenants:
        try:
            if try_charge_platform_fee(tenant):
                charged += 1
            else:
                overdue += 1
        except Exception:
            logger.exception("Failed to process platform fee for tenant %s", tenant.company_name)

    logger.info("charge_platform_fees: %d charged/current, %d now overdue", charged, overdue)
    return {"charged": charged, "overdue": overdue}