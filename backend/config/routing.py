"""Project-level WebSocket routing.

Per-app routes will be appended to ``websocket_urlpatterns`` as Channels
consumers are introduced (e.g. real-time invoice / dashboard updates).
"""

from django.urls import re_path  # noqa: F401  (kept for future routes)

websocket_urlpatterns: list = []
