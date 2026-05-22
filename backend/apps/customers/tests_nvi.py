from __future__ import annotations

from django.test import SimpleTestCase, tag

from apps.customers.address_fixtures import (
    KADIKOY_ILCE,
    KADIKOY_NO2_BINA,
    KADIKOY_NO3,
    MAHALLE_19_MAYIS,
    YOL_23_NISAN,
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
