from django.urls import path

from scraper.views import ExistingLeadsSearchView, ScrapeSearchView, ScrapeTaskStatusView

urlpatterns = [
    path("search/", ScrapeSearchView.as_view(), name="scrape-search"),
    path("tasks/<int:pk>/", ScrapeTaskStatusView.as_view(), name="scrape-task-status"),
    path("existing-leads/", ExistingLeadsSearchView.as_view(), name="existing-leads-search"),
]