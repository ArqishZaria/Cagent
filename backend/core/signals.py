"""
Sets each new tenant's first platform-fee due date the moment the Tenant
row is created — mirrors wallet.signals.create_wallet_for_new_tenant so a
tenant never exists without a scheduled next_platform_fee_charge_at.
"""

from datetime import timedelta

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from core.models import Tenant


@receiver(post_save, sender=Tenant)
def schedule_first_platform_fee_charge(sender, instance, created, **kwargs):
    if created and instance.next_platform_fee_charge_at is None:
        instance.next_platform_fee_charge_at = timezone.now() + timedelta(days=30)
        instance.save(update_fields=["next_platform_fee_charge_at"])