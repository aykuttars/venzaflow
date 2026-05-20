from django.urls import path

from apps.accounts import views_platform

urlpatterns = [
    path("auth/login/", views_platform.PlatformLoginView.as_view(), name="platform-auth-login"),
    path("auth/me/", views_platform.PlatformMeView.as_view(), name="platform-auth-me"),
    path(
        "auth/refresh/",
        views_platform.PlatformTokenRefreshView.as_view(),
        name="platform-auth-refresh",
    ),
    path("auth/logout/", views_platform.PlatformLogoutView.as_view(), name="platform-auth-logout"),
]
