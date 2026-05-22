from __future__ import annotations

from io import BytesIO
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import Department, Permission
from apps.common.permission_codes import PERMISSION_CODENAMES
from apps.customers.address_fixtures import SAMPLE_HOME_ADDRESS
from apps.customers.models import Customer
from apps.customers.patient_photo import PHOTO_SIZE, process_patient_photo
from apps.tenants.models import Tenant
from apps.tenants.subscription_service import set_module_subscriptions

from django.contrib.auth import get_user_model

User = get_user_model()

_MOCK_IDENTITY = {
    "verified": True,
    "reference": "mock-ref",
    "normalized_first_name": "FOTO",
    "normalized_last_name": "HASTA",
}

VALID_TCKN = "11111111110"


def _make_test_image(width: int = 800, height: int = 600, fmt: str = "JPEG") -> SimpleUploadedFile:
    buffer = BytesIO()
    Image.new("RGB", (width, height), color=(120, 80, 200)).save(buffer, format=fmt)
    buffer.seek(0)
    content_type = "image/jpeg" if fmt == "JPEG" else f"image/{fmt.lower()}"
    return SimpleUploadedFile("portrait.jpg", buffer.read(), content_type=content_type)


class PatientPhotoProcessingTests(SimpleTestCase):
    def test_resizes_to_200x200_jpeg(self):
        processed = process_patient_photo(_make_test_image())
        image = Image.open(processed)
        self.assertEqual(image.size, PHOTO_SIZE)
        self.assertEqual(image.format, "JPEG")


class PatientPhotoApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        for codename, name in PERMISSION_CODENAMES:
            Permission.objects.get_or_create(codename=codename, defaults={"name": name})

        cls.tenant = Tenant.objects.create(customer_code="CLINIC3", name="Clinic Photo", max_users=5)
        cls.other_tenant = Tenant.objects.create(customer_code="OTHER3", name="Other", max_users=5)
        set_module_subscriptions(cls.tenant, ["patients"], extra_modules=set())
        set_module_subscriptions(cls.other_tenant, ["patients"], extra_modules=set())
        cls.dept = Department.objects.create(tenant=cls.tenant, key="doc", name="Doctor")
        cls.dept.permissions.set(
            Permission.objects.filter(codename__in=("patients.read", "patients.write"))
        )
        cls.user = User.all_tenants.create(
            tenant=cls.tenant, email="photo@clinic.test", department=cls.dept, is_active=True
        )
        cls.user.set_password("StaffPass1!X")
        cls.user.save()

    def setUp(self):
        self.client = APIClient()
        r = self.client.post(
            "/api/v1/auth/login/",
            {"customer_code": "CLINIC3", "email": "photo@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['access']}")

    @patch("apps.customers.serializers.verify_identity", return_value=_MOCK_IDENTITY)
    def _create_patient(self, _mock_identity) -> Customer:
        payload = {
            "nationality": "tc",
            "first_name": "Foto",
            "last_name": "Hasta",
            "tckn": VALID_TCKN,
            "birth_date": "1990-05-15",
            "mobile_phone": "5321234567",
            "email": "foto@example.com",
            "home_address": SAMPLE_HOME_ADDRESS,
        }
        r = self.client.post("/api/v1/patients/", payload, format="json")
        self.assertEqual(r.status_code, 201, r.content)
        return Customer.all_tenants.get(pk=r.json()["id"])

    @patch("apps.customers.serializers.verify_identity", return_value=_MOCK_IDENTITY)
    def test_upload_and_fetch_photo(self, _mock_identity):
        patient = self._create_patient()
        upload = self.client.post(
            f"/api/v1/patients/{patient.pk}/photo/",
            {"photo": _make_test_image()},
            format="multipart",
        )
        self.assertEqual(upload.status_code, 200, upload.content)

        patient.refresh_from_db()
        self.assertEqual(
            patient.photo.name,
            f"tenants/{self.tenant.pk}/photos/{patient.pk}.jpg",
        )

        detail = self.client.get(f"/api/v1/patients/{patient.pk}/")
        self.assertTrue(detail.json()["has_photo"])

        photo = self.client.get(f"/api/v1/patients/{patient.pk}/photo/")
        self.assertEqual(photo.status_code, 200)
        self.assertEqual(photo["Content-Type"], "image/jpeg")
        image = Image.open(BytesIO(photo.content))
        self.assertEqual(image.size, PHOTO_SIZE)

    @patch("apps.customers.serializers.verify_identity", return_value=_MOCK_IDENTITY)
    def test_other_tenant_cannot_access_photo(self, _mock_identity):
        patient = self._create_patient()
        self.client.post(
            f"/api/v1/patients/{patient.pk}/photo/",
            {"photo": _make_test_image()},
            format="multipart",
        )

        other_dept = Department.objects.create(tenant=self.other_tenant, key="doc", name="Other Doc")
        other_dept.permissions.set(
            Permission.objects.filter(codename__in=("patients.read", "patients.write"))
        )
        other_user = User.all_tenants.create(
            tenant=self.other_tenant,
            email="other@clinic.test",
            department=other_dept,
            is_active=True,
        )
        other_user.set_password("StaffPass1!X")
        other_user.save()

        other_client = APIClient()
        login = other_client.post(
            "/api/v1/auth/login/",
            {"customer_code": "OTHER3", "email": "other@clinic.test", "password": "StaffPass1!X"},
            format="json",
        )
        other_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}")

        r = other_client.get(f"/api/v1/patients/{patient.pk}/photo/")
        self.assertIn(r.status_code, (403, 404))

    def test_rejects_invalid_upload(self):
        patient = Customer.all_tenants.create(
            tenant=self.tenant,
            kind=Customer.Kind.PATIENT,
            first_name="X",
            last_name="Y",
            mobile_phone="5321112233",
            email="x@y.com",
            home_address=SAMPLE_HOME_ADDRESS,
        )
        r = self.client.post(
            f"/api/v1/patients/{patient.pk}/photo/",
            {"photo": SimpleUploadedFile("bad.txt", b"not-an-image", content_type="text/plain")},
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)
