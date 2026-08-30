from django.urls import path

from support.views import SupportAttachmentDownloadView, SupportHistoryView, SupportSendView

urlpatterns = [
    path("history/", SupportHistoryView.as_view(), name="support-history"),
    path("send/", SupportSendView.as_view(), name="support-send"),
    path("<int:pk>/attachment/", SupportAttachmentDownloadView.as_view(), name="support-attachment"),
]