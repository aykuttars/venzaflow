from __future__ import annotations

from datetime import date
from unittest.mock import patch

from django.test import SimpleTestCase, tag

from apps.customers.address_fixtures import (
    KADIKOY_ILCE,
    KADIKOY_NO2_BINA,
    KADIKOY_NO3,
    MAHALLE_19_MAYIS,
    YOL_23_NISAN,
)
from apps.customers.identity_fixtures import (
    FOREIGN_IDENTITY_NVI_FAILURE,
    FOREIGN_IDENTITY_NVI_SUCCESS,
    FOREIGN_IDENTITY_SAMPLE,
    RESIDENCE_VERIFY_NVI_FAILURE,
    RESIDENCE_VERIFY_NVI_SUCCESS,
    RESIDENCE_VERIFY_SAMPLE,
)
from apps.integrations.nvi_identity import NviIdentityHandler, _identity_payload_ok


class NviPatientVerifyUnitTests(SimpleTestCase):
    @patch("apps.customers.nvi_views.verify_residence_address")
    @patch("apps.customers.nvi_views.verify_identity")
    def test_verify_patient_nvi_runs_both_steps(self, mock_identity, mock_residence):
        from datetime import date

        from apps.customers.nvi_views import verify_patient_nvi

        mock_identity.return_value = {
            "verified": True,
            "reference": "ref-1",
            "normalized_first_name": "AYŞE",
            "normalized_last_name": "YILMAZ",
        }
        mock_residence.return_value = {"verified": True}
        attrs = {
            "nationality": "tc",
            "first_name": "Ayşe",
            "last_name": "Yılmaz",
            "birth_date": date(1990, 1, 1),
            "tckn": "11111111110",
            "home_address": {"address_code": 1559871163, "full_address": "Test"},
        }
        verify_patient_nvi(instance=None, attrs=attrs)
        mock_identity.assert_called_once()
        mock_residence.assert_called_once()
        self.assertTrue(attrs["nvi_verified"])
        self.assertTrue(attrs["home_address"]["nvi_residence_verified"])

    @patch("apps.customers.nvi_views.verify_identity")
    def test_verify_patient_nvi_stops_at_identity_failure(self, mock_identity):
        from datetime import date

        from apps.customers.nvi_views import NviIdentityMismatch, NviVerificationError, verify_patient_nvi

        mock_identity.side_effect = NviIdentityMismatch("Identity does not match NVI records.")
        attrs = {
            "nationality": "tc",
            "first_name": "Ayşe",
            "last_name": "Yılmaz",
            "birth_date": date(1990, 1, 1),
            "tckn": "11111111110",
            "home_address": {"address_code": 1559871163},
        }
        with self.assertRaises(NviVerificationError) as ctx:
            verify_patient_nvi(instance=None, attrs=attrs)
        self.assertEqual(ctx.exception.step, "identity")


class NviResidenceUnitTests(SimpleTestCase):
    def test_parse_residence_success(self):
        from apps.customers.nvi_views import _parse_residence_result

        parsed = _parse_residence_result({"success": True, "data": RESIDENCE_VERIFY_NVI_SUCCESS})
        self.assertTrue(parsed["verified"])
        self.assertTrue(parsed["address_correct"])

    def test_parse_residence_failure(self):
        from apps.customers.nvi_views import _parse_residence_result

        parsed = _parse_residence_result({"success": True, "data": RESIDENCE_VERIFY_NVI_FAILURE})
        self.assertFalse(parsed["verified"])

    @patch("apps.customers.nvi_views._get_handler")
    def test_verify_residence_address_success(self, mock_get_handler):
        from apps.customers.nvi_views import verify_residence_address

        mock_get_handler.return_value.kisi_adres_oturuyormu.return_value = {
            "success": True,
            "data": RESIDENCE_VERIFY_NVI_SUCCESS,
        }
        result = verify_residence_address(
            tckn=RESIDENCE_VERIFY_SAMPLE["tckn"],
            home_address={"address_code": RESIDENCE_VERIFY_SAMPLE["address_code"]},
        )
        self.assertTrue(result["verified"])
        mock_get_handler.return_value.kisi_adres_oturuyormu.assert_called_once_with(
            RESIDENCE_VERIFY_SAMPLE["tckn"],
            RESIDENCE_VERIFY_SAMPLE["address_code"],
        )

    @patch("apps.customers.nvi_views._get_handler")
    def test_verify_residence_address_mismatch(self, mock_get_handler):
        from apps.customers.nvi_views import NviAddressMismatch, verify_residence_address

        mock_get_handler.return_value.kisi_adres_oturuyormu.return_value = {
            "success": True,
            "data": RESIDENCE_VERIFY_NVI_FAILURE,
        }
        with self.assertRaises(NviAddressMismatch):
            verify_residence_address(
                tckn=RESIDENCE_VERIFY_SAMPLE["tckn"],
                home_address={"address_code": RESIDENCE_VERIFY_SAMPLE["address_code"]},
            )


class NviForeignIdentityUnitTests(SimpleTestCase):
    def test_identity_payload_ok_on_nvi_success_response(self):
        self.assertTrue(_identity_payload_ok(FOREIGN_IDENTITY_NVI_SUCCESS))

    def test_identity_payload_ok_on_nvi_failure_response(self):
        self.assertFalse(_identity_payload_ok(FOREIGN_IDENTITY_NVI_FAILURE))

    @patch("apps.integrations.nvi_identity._get_foreign_handler")
    def test_confirm_foreign_normalizes_nvi_success(self, mock_get_handler):
        mock_get_handler.return_value.yabanci_kimlik_dogrula.return_value = {
            "success": True,
            "data": FOREIGN_IDENTITY_NVI_SUCCESS,
        }
        result = NviIdentityHandler.confirm_foreign(
            FOREIGN_IDENTITY_SAMPLE["first_name"],
            FOREIGN_IDENTITY_SAMPLE["last_name"],
            FOREIGN_IDENTITY_SAMPLE["tckn"],
            "19.09.1993",
        )
        self.assertTrue(result["success"])
        self.assertTrue(result["response"]["success"])

    @patch("apps.customers.nvi_views.NviIdentityHandler.confirm_foreign")
    def test_verify_identity_foreign_with_sample_data(self, mock_confirm):
        mock_confirm.return_value = {
            "success": True,
            "response": {"success": True},
        }
        from apps.customers.nvi_views import verify_identity

        result = verify_identity(
            nationality=FOREIGN_IDENTITY_SAMPLE["nationality"],
            first_name=FOREIGN_IDENTITY_SAMPLE["first_name"],
            last_name=FOREIGN_IDENTITY_SAMPLE["last_name"],
            birth_date=date.fromisoformat(FOREIGN_IDENTITY_SAMPLE["birth_date"]),
            tckn=FOREIGN_IDENTITY_SAMPLE["tckn"],
        )
        self.assertTrue(result["verified"])
        self.assertEqual(result["normalized_first_name"], "OGULJENNET")
        mock_confirm.assert_called_once_with(
            "OGULJENNET",
            "ESENOVA",
            "99210444902",
            "19.09.1993",
        )


@tag("nvi_live")
class NviKadikoyLiveTests(SimpleTestCase):
    views = None
    _skip = True
    _skip_reason = "NVI API erişilemiyor"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        try:
            from apps.customers import nvi_views

            cls.views = nvi_views
            rows = nvi_views.list_districts(34)
            if any(row["code"] == KADIKOY_ILCE for row in rows):
                cls._skip = False
                cls._skip_reason = ""
        except Exception as exc:
            cls._skip = True
            cls._skip_reason = f"NVI API erişilemiyor: {exc}"

    def setUp(self):
        if self._skip:
            self.skipTest(self._skip_reason)

    def test_kadikoy_23_nisan_no3_open_address(self):
        buildings = self.views.list_buildings(MAHALLE_19_MAYIS, YOL_23_NISAN)
        codes = {row["code"] for row in buildings}
        self.assertIn(KADIKOY_NO3["bina"], codes)

        units = self.views.list_units(MAHALLE_19_MAYIS, KADIKOY_NO3["bina"])
        self.assertTrue(units)
        self.assertIn(KADIKOY_NO3["unit"], {row["code"] for row in units})

        row = self.views.get_open_address(
            MAHALLE_19_MAYIS,
            unit_kimlik_no=KADIKOY_NO3["unit"],
        )
        self.assertEqual(row["address_code"], KADIKOY_NO3["address_code"])
        self.assertEqual(row["resolved_at"], "unit")
        self.assertIn("KADIKÖY", row["full_address"].upper())
        self.assertIn("23 NİSAN", row["full_address"].upper())

    def test_kadikoy_23_nisan_no2_open_address(self):
        units = self.views.list_units(MAHALLE_19_MAYIS, KADIKOY_NO2_BINA)
        if not units:
            self.skipTest("23 NİSAN No:2 için iç kapı listesi boş")

        row = self.views.get_open_address(
            MAHALLE_19_MAYIS,
            unit_kimlik_no=units[0]["code"],
        )
        self.assertGreater(int(row["address_code"]), 0)
        self.assertIn("KADIKÖY", row["full_address"].upper())
        self.assertIn("23 NİSAN", row["full_address"].upper())


@tag("nvi_live")
class NviForeignIdentityLiveTests(SimpleTestCase):
    _skip = True
    _skip_reason = "NVI yabancı kimlik API erişilemiyor"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        try:
            result = NviIdentityHandler.confirm_foreign(
                FOREIGN_IDENTITY_SAMPLE["first_name"],
                FOREIGN_IDENTITY_SAMPLE["last_name"],
                FOREIGN_IDENTITY_SAMPLE["tckn"],
                "19.09.1993",
            )
            if result.get("success") and result["response"].get("success"):
                cls._skip = False
                cls._skip_reason = ""
        except Exception as exc:
            cls._skip = True
            cls._skip_reason = f"NVI yabancı kimlik API erişilemiyor: {exc}"

    def setUp(self):
        if self._skip:
            self.skipTest(self._skip_reason)

    def test_foreign_identity_sample_verifies_live(self):
        result = NviIdentityHandler.confirm_foreign(
            FOREIGN_IDENTITY_SAMPLE["first_name"],
            FOREIGN_IDENTITY_SAMPLE["last_name"],
            FOREIGN_IDENTITY_SAMPLE["tckn"],
            "19.09.1993",
        )
        self.assertTrue(result["success"], result.get("reason"))
        self.assertTrue(result["response"]["success"])