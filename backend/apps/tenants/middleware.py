from __future__ import annotations

from django.utils.deprecation import MiddlewareMixin

from apps.tenants.context import clear_current_tenant, set_tenant_context


class TenantContextMiddleware(MiddlewareMixin):
    """
    After authentication, bind tenant from JWT claims to thread-local context.
    Login views are unauthenticated; tenant is set after token validation in auth.
    """

    def process_request(self, request):
        clear_current_tenant()
        user = getattr(request, "user", None)
        if user and user.is_authenticated:
            tenant_id = getattr(user, "tenant_id", None)
            if tenant_id:
                set_tenant_context(tenant_id)

    def process_response(self, request, response):
        clear_current_tenant()
        return response

    def process_exception(self, request, exception):
        clear_current_tenant()
        return None
