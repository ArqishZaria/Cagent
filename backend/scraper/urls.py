from django.urls import path

from scraper.views import ScrapeSearchView, ScrapeTaskStatusView

urlpatterns = [
    path("search/", ScrapeSearchView.as_view(), name="scrape-search"),
    path("tasks/<int:pk>/", ScrapeTaskStatusView.as_view(), name="scrape-task-status"),
]
