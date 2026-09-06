from django.urls import path

from users.views import (
    ChangePasswordView, ManageUserView, MeView, PasswordResetConfirmView,
    PasswordResetRequestView, UserListView,
)

urlpatterns = [
    path("", UserListView.as_view(), name="user-list"),
    path("manage/", ManageUserView.as_view(), name="user-manage"),
    path("profile/", MeView.as_view(), name="user-me"),
    path("change-password/", ChangePasswordView.as_view(), name="change-password"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]