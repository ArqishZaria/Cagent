from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.contact_views import ContactSubmitView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/contact/", ContactSubmitView.as_view(), name="contact-submit"),
    path("api/users/", include("users.urls")),
    path("api/telephony/", include("telephony.urls")),
    path("api/scraper/", include("scraper.urls")),
    path("api/support/", include("support.urls")),
    path("api/", include("crm.urls")),
    path("api/wallet/", include("wallet.urls")),
]