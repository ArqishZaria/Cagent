from django.contrib import admin
from django.urls import include, path
from core.auth_views import LogoutView, ThrottledTokenObtainPairView, ThrottledTokenRefreshView


from core.auth_views import (
    LogoutView, ThrottledTokenObtainPairView, ThrottledTokenRefreshView,
)
from core.contact_views import ContactSubmitView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", ThrottledTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/token/refresh/", ThrottledTokenRefreshView.as_view(), name="token_refresh"),
    path("api/auth/logout/", LogoutView.as_view(), name="token_logout"),
    path("api/contact/", ContactSubmitView.as_view(), name="contact-submit"),
    path("api/users/", include("users.urls")),
    path("api/telephony/", include("telephony.urls")),
    path("api/scraper/", include("scraper.urls")),
    path("api/support/", include("support.urls")),
    path("api/wallet/", include("wallet.urls")),
    path("api/", include("crm.urls")),
]