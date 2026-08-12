from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    # JWT auth — whitelisted in core.middleware.IsSubscriptionActive so a
    # PAID_OVERDUE tenant can still log in.
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/users/", include("users.urls")),
    path("api/telephony/", include("telephony.urls")),
    path("api/scraper/", include("scraper.urls")),
    path("api/support/", include("support.urls")),
    path("api/", include("crm.urls")),  # -> /api/leads/, /api/interactions/
]
