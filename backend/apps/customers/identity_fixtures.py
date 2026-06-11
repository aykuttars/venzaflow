"""NVI kimlik doğrulama test verileri."""

from __future__ import annotations

FOREIGN_IDENTITY_SAMPLE = {
    "nationality": "foreign",
    "tckn": "99210444902",
    "first_name": "OGULJENNET",
    "last_name": "ESENOVA",
    "birth_date": "1993-09-19",
}

FOREIGN_IDENTITY_NVI_SUCCESS = {
    "YbKimlikNo": 99210444902,
    "Ad": "OGULJENNET",
    "Soyad": "ESENOVA",
    "DogumGun": None,
    "DogumAy": None,
    "DogumYil": 1993,
    "MaviKartliAciklama": "HAYIR",
    "HataAciklama": None,
}

FOREIGN_IDENTITY_NVI_FAILURE = {
    "YbKimlikNo": 99210444902,
    "Ad": "OGULJENNET",
    "Soyad": "ESENOVA",
    "DogumGun": None,
    "DogumAy": None,
    "DogumYil": 1993,
    "MaviKartliAciklama": "HAYIR",
    "HataAciklama": "Girilen bilgiler doğrulanamadı.",
}

RESIDENCE_VERIFY_SAMPLE = {
    "tckn": "10016722964",
    # AcikAdres(bagimsizBolumKayitNo=41661440) → adresNo; teyit isteğinde bu değer kullanılır.
    "address_code": 1559871163,
    "unit_code": 41661440,
}

RESIDENCE_VERIFY_NVI_SUCCESS = {
    "success": True,
    "message": "",
    "result": {
        "kisininOturduguAdresVar": True,
        "verilenAdresDogru": True,
        "kisininOturduguAdresYok": False,
        "verilenAdresDogruDegil": False,
    },
}

RESIDENCE_VERIFY_NVI_FAILURE = {
    "success": True,
    "message": "",
    "result": {
        "kisininOturduguAdresVar": True,
        "verilenAdresDogru": False,
        "kisininOturduguAdresYok": False,
        "verilenAdresDogruDegil": True,
    },
}
