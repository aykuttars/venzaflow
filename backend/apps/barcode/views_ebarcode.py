from __future__ import annotations

from django.http import Http404, StreamingHttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import HasModule, HasViewPermission
from apps.barcode.services import ebarcode_artifacts


class EbarcodeReleasesView(APIView):
    """Latest released e-barcode installers (barcode module users only)."""

    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.scan"

    def get(self, request):
        def download_url(slug: str) -> str:
            path = f"/api/v1/barcode/ebarcode/download/{slug}/"
            return request.build_absolute_uri(path)

        return Response(ebarcode_artifacts.build_releases_payload(download_url_builder=download_url))


class EbarcodeDownloadView(APIView):
    """Stream a released installer from the artifact registry (barcode module users only)."""

    permission_classes = [HasModule, HasViewPermission]
    required_module = "barcode"
    required_permission = "barcode.scan"

    def get(self, request, slug: str):
        if slug not in ebarcode_artifacts.PLATFORM_BY_SLUG:
            raise Http404("Platform not found.")
        try:
            _tag, digest, filename = ebarcode_artifacts.resolve_download(slug)
        except ebarcode_artifacts.ArtifactRegistryNotConfigured:
            raise Http404("Download service is not configured.") from None
        except ebarcode_artifacts.ArtifactRegistryError as exc:
            raise Http404(str(exc)) from exc

        response = StreamingHttpResponse(
            ebarcode_artifacts.stream_blob(digest),
            content_type="application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Cache-Control"] = "no-store"
        return response
