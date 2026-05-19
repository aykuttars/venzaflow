from __future__ import annotations

import re

from rest_framework import serializers

SPECIAL_CHARS = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>/?`~]")

PASSWORD_RULES = (
    (lambda p: len(p) >= 12, "Password must be at least 12 characters."),
    (lambda p: re.search(r"[A-Z]", p), "Password must contain at least one uppercase letter."),
    (lambda p: re.search(r"[a-z]", p), "Password must contain at least one lowercase letter."),
    (lambda p: re.search(r"\d", p), "Password must contain at least one digit."),
    (lambda p: SPECIAL_CHARS.search(p), "Password must contain at least one special character."),
)


def validate_password_policy(password: str) -> None:
    """Raise DRF ValidationError when password does not meet policy."""
    for check, message in PASSWORD_RULES:
        if not check(password):
            raise serializers.ValidationError({"password": message})
