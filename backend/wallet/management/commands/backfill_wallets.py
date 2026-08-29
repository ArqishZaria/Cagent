from django.core.management.base import BaseCommand

from core.models import Tenant
from wallet.models import TenantWallet


class Command(BaseCommand):
    help = "Creates a $0 TenantWallet for any existing tenant that doesn't have one yet."

    def handle(self, *args, **options):
        created = 0
        for tenant in Tenant.objects.all():
            _, was_created = TenantWallet.objects.get_or_create(tenant=tenant)
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Created {created} missing wallet(s)."))