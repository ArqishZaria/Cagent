from django.urls import path

from wallet.views import (
    GatewayWebhookView, PricingRateListView, TopupCreateView,
    TopupHistoryView, TopupInvoiceDownloadView, TopupQuoteView, TopupStatusView,
    TransactionBreakdownView, TransactionListView, WalletSummaryView,
)

urlpatterns = [
    path("", WalletSummaryView.as_view(), name="wallet-summary"),
    path("topups/quote/", TopupQuoteView.as_view(), name="topup-quote"),
    path("topups/", TopupCreateView.as_view(), name="topup-create"),
    path("topups/history/", TopupHistoryView.as_view(), name="topup-history"),
    path("topups/<int:pk>/", TopupStatusView.as_view(), name="topup-status"),
    path("topups/<int:pk>/invoice/", TopupInvoiceDownloadView.as_view(), name="topup-invoice"),
    path("webhooks/payfast/", GatewayWebhookView.as_view(), name="wallet-webhook"),
    path("transactions/", TransactionListView.as_view(), name="wallet-transactions"),
    path("transactions/breakdown/", TransactionBreakdownView.as_view(), name="wallet-breakdown"),
    path("pricing-rates/", PricingRateListView.as_view(), name="pricing-rates"),
]