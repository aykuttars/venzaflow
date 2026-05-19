from __future__ import annotations

import re

from django.utils.translation import gettext as _
from rest_framework import serializers

SPECIAL_CHARS = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?`~]")

PASSWORD_RULE_KEYS = (
    (lambda p: len(p) >= 12, "password_min_length"),
    (lambda p: re.search(r"[A-Z]", p), "password_uppercase"),
    (lambda p: re.search(r"[a-z]", p), "password_lowercase"),
    (lambda p: re.search(r"\d", p), "password_digit"),
    (lambda p: SPECIAL_CHARS.search(p), "password_special"),
)

_PASSWORD_MSGIDS = {
    "password_min_length": "Password must be at least 12 characters.",
    "password_uppercase": "Password must contain at least one uppercase letter.",
    "password_lowercase": "Password must contain at least one lowercase letter.",
    "password_digit": "Password must contain at least one digit.",
    "password_special": "Password must contain at least one special character.",
}


def validate_password_policy(password: str) -> None:
    """Raise DRF ValidationError when password does not meet policy."""
    for check, key in PASSWORD_RULE_KEYS:
        if not check(password):
            raise serializers.ValidationError({"password": _(_PASSWORD_MSGIDS[key])})
