from django.urls import path

from support.views import SupportHistoryView, SupportSendView

urlpatterns = [
    path("history/", SupportHistoryView.as_view(), name="support-history"),
    path("send/", SupportSendView.as_view(), name="support-send"),
]
