from __future__ import annotations

from io import BytesIO

from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.utils.translation import gettext_lazy as _
from PIL import Image, UnidentifiedImageError

PHOTO_SIZE = (200, 200)
PHOTO_MAX_BYTES = 5 * 1024 * 1024
PHOTO_JPEG_QUALITY = 85
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


def patient_photo_upload_to(instance, filename: str) -> str:
    """Tenant-isolated path: tenants/{tenant_id}/photos/{patient_id}.jpg"""
    return f"tenants/{instance.tenant_id}/photos/{instance.pk}.jpg"


def process_patient_photo(uploaded_file) -> ContentFile:
    size = getattr(uploaded_file, "size", None)
    if size is not None and size > PHOTO_MAX_BYTES:
        raise ValidationError(_("Photo must be 5 MB or smaller."))

    content_type = getattr(uploaded_file, "content_type", "") or ""
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(_("Upload a JPEG, PNG, or WebP image."))

    try:
        image = Image.open(uploaded_file)
        image.verify()
        uploaded_file.seek(0)
        image = Image.open(uploaded_file)
    except (UnidentifiedImageError, OSError) as exc:
        raise ValidationError(_("Upload a valid image file.")) from exc

    image = image.convert("RGB")
    image = _center_crop_square(image)
    image = image.resize(PHOTO_SIZE, Image.Resampling.LANCZOS)

    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=PHOTO_JPEG_QUALITY, optimize=True)
    return ContentFile(buffer.getvalue(), name="photo.jpg")


def _center_crop_square(image: Image.Image) -> Image.Image:
    width, height = image.size
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return image.crop((left, top, left + side, top + side))
