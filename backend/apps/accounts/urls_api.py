from django.urls import path

from apps.accounts import views
from apps.accounts.views_permissions import PermissionListView
from apps.tenants.views import TenantProfileView

urlpatterns = [
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", views.TenantTokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("permissions/", PermissionListView.as_view(), name="permission-list"),
    path("tenant/", TenantProfileView.as_view(), name="tenant-profile"),
]
