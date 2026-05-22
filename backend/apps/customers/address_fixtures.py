"""Kadıköy örnek adresi — NVI Harita kimlikNo (canlı doğrulandı)."""

from __future__ import annotations

KADIKOY_ILCE = 1421
MAHALLE_19_MAYIS = 40528
YOL_23_NISAN = 223868

KADIKOY_NO3 = {
    "bina": 288470578,
    "unit": 17416053,
    "address_code": 2110022015,
}

KADIKOY_NO2_BINA = 280180902

SAMPLE_HOME_ADDRESS = {
    "province_code": 34,
    "province_name": "İSTANBUL",
    "district_code": KADIKOY_ILCE,
    "district_name": "KADIKÖY",
    "neighborhood_code": MAHALLE_19_MAYIS,
    "neighborhood_name": "19 MAYIS MAHALLESİ",
    "street_code": YOL_23_NISAN,
    "street_name": "23 NİSAN (Sokak)",
    "building_code": KADIKOY_NO3["bina"],
    "building_no": "3",
    "unit_code": KADIKOY_NO3["unit"],
    "apartment_no": "1",
    "address_code": KADIKOY_NO3["address_code"],
    "full_address": "19 MAYIS MAH. 23 NİSAN SK. NO: 3 İÇ KAPI NO: 1 KADIKÖY / İSTANBUL",
}
