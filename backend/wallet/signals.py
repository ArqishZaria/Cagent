from django.db.models.signals import post_save
from django.dispatch import receiver

from core.models import Tenant
from wallet.models import TenantWallet


@receiver(post_save, sender=Tenant)
def create_wallet_for_new_tenant(sender, instance, created, **kwargs):
    """
    Every tenant gets a $0 wallet the instant they're created — guarantees
    WalletTransaction.apply() (which locks and fetches an existing
    TenantWallet row, not get_or_create) never hits a DoesNotExist on a
    tenant's very first top-up or usage event, no matter which view happens
    to touch the wallet first.
    """
    if created:
        TenantWallet.objects.get_or_create(tenant=instance)