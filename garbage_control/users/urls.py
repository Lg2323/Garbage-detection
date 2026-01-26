from django.urls import path

from .views import (
    CookieTokenObtainPairView,
    CookieTokenRefreshView,
    LogoutView,
    RegisterView,
    WorkersListView,
    MeView,
)

urlpatterns = [
    path("register/", RegisterView.as_view()),
    path("login/", CookieTokenObtainPairView.as_view()),
    path("refresh/", CookieTokenRefreshView.as_view()),
    path("logout/", LogoutView.as_view()),
    path("workers/", WorkersListView.as_view()),
    path("me/", MeView.as_view()),
]
