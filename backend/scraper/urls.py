from django.urls import path

from scraper.views import (
    ExistingLeadsSearchView,
    LeadUploadStatusView,
    LeadUploadView,
    ScrapeSearchView,
    ScrapeTaskStatusView,
)

urlpatterns = [
    path("search/", ScrapeSearchView.as_view(), name="scrape-search"),
    path("tasks/<int:pk>/", ScrapeTaskStatusView.as_view(), name="scrape-task-status"),
    path("existing-leads/", ExistingLeadsSearchView.as_view(), name="existing-leads-search"),
    path("upload/", LeadUploadView.as_view(), name="lead-upload"),
    path("upload-tasks/<int:pk>/", LeadUploadStatusView.as_view(), name="lead-upload-status"),
]