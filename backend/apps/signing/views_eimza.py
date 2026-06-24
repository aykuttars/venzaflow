from __future__ import annotations

from django.http import Http404, StreamingHttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.signing.services import eimza_artifacts


class EimzaReleasesView(APIView):
    """Latest released e-imza installers for end users (public, no login)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        def download_url(slug: str) -> str:
            path = f"/api/v1/sign/eimza/download/{slug}/"
            return request.build_absolute_uri(path)

        return Response(eimza_artifacts.build_releases_payload(download_url_builder=download_url))


class EimzaDownloadView(APIView):
    """Stream a released installer from the artifact registry (public)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, slug: str):
        if slug not in eimza_artifacts.PLATFORM_BY_SLUG:
            raise Http404("Platform not found.")
        try:
            _tag, digest, filename = eimza_artifacts.resolve_download(slug)
        except eimza_artifacts.ArtifactRegistryNotConfigured:
            raise Http404("Download service is not configured.") from None
        except eimza_artifacts.ArtifactRegistryError as exc:
            raise Http404(str(exc)) from exc

        response = StreamingHttpResponse(
            eimza_artifacts.stream_blob(digest),
            content_type="application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "no-store"
        return response
