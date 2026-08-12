from django.urls import path

from users.views import ManageUserView, UserListView

urlpatterns = [
    path("", UserListView.as_view(), name="user-list"),
    path("manage/", ManageUserView.as_view(), name="user-manage"),
]
