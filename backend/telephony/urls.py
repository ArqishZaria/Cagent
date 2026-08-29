from django.urls import path
from rest_framework.routers import DefaultRouter

from telephony.views import (
    CallEligibilityView,
    NumberPurchaseView,
    NumberSearchView,
    NumberViewSet,
    SMSSendView,
    SMSWebhookView,
    VoiceWebhookView,
    WebRTCCredentialsView,
)

router = DefaultRouter()
router.register("numbers", NumberViewSet, basename="phonenumber")

urlpatterns = [
    path("webrtc/credentials/", WebRTCCredentialsView.as_view(), name="webrtc-credentials"),
    path("calls/check-balance/", CallEligibilityView.as_view(), name="call-eligibility"),
    path("webhooks/voice/", VoiceWebhookView.as_view(), name="voice-webhook"),
    path("sms/send/", SMSSendView.as_view(), name="sms-send"),
    path("webhooks/sms/", SMSWebhookView.as_view(), name="sms-webhook"),
    path("numbers/search/", NumberSearchView.as_view(), name="number-search"),
    path("numbers/purchase/", NumberPurchaseView.as_view(), name="number-purchase"),
] + router.urls