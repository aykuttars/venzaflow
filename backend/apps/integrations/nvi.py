from __future__ import annotations

import base64
import json
import re
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup


class NviHandler:
    """NVI adres sorgulama + reCAPTCHA.

    >> nvi = NviHandler()
    >> nvi.il_list()
    >> nvi.ilce_list(34)
    >> nvi.acik_adres(98696, 18978569)
    """

    RECAPTCHA_SITE_KEY = "6LcrFjwUAAAAABui7fXG9wtscqRlt6Avzxfxkmdz"
    RECAPTCHA_SITE_URL = "https://adres.nvi.gov.tr:443"
    RECAPTCHA_RESPONSE_BLOB = "eyJyZXNwb25zZSI6IiIsInMiOiI5NTYyIiwiZSI6ImJYVnMifQ.."
    RECAPTCHA_USER_AGENT = (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
    )

    token = ""
    cookies: dict = {}

    def __init__(self) -> None:
        self.homepage_url = "https://adres.nvi.gov.tr/VatandasIslemleri/AdresSorgu"
        self.il_url = "https://adres.nvi.gov.tr/Harita/ilListesi"
        self.ilce_url = "https://adres.nvi.gov.tr/Harita/ilceListesi"
        self.mahalle_url = "https://adres.nvi.gov.tr/Harita/mahalleKoyBaglisiListesi"
        self.yol_url = "https://adres.nvi.gov.tr/Harita/yolListesi"
        self.bina_url = "https://adres.nvi.gov.tr/Harita/binaListesi"
        self.bagimsizbolum_url = "https://adres.nvi.gov.tr/Harita/bagimsizBolumListesi"
        self.acikadres_url = "https://adres.nvi.gov.tr/Harita/AcikAdres"
        self.sess = requests.Session()
        self.sess.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36"
                ),
            }
        )
        self.initialize_token()

    def initialize_token(self) -> None:
        r = self.sess.get(self.homepage_url)
        soup = BeautifulSoup(r.content, "html.parser")
        self.token = soup.find("input", {"name": "__RequestVerificationToken"}).get("value")
        self.cookies = self.sess.cookies.get_dict()
        self.sess.headers.update(
            {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": "https://adres.nvi.gov.tr/VatandasIslemleri/AdresSorgu",
                "__RequestVerificationToken": self.token,
                "Host": "adres.nvi.gov.tr",
            }
        )

    # --- reCAPTCHA (anchor -> reload -> userverify) ---

    @classmethod
    def _rc_base64(cls, text: str) -> str:
        return base64.b64encode(text.encode(), b"-_").decode().replace("=", ".")

    @classmethod
    def _varint(cls, value: int, out: bytearray) -> None:
        n = value
        while True:
            b = n & 0x7F
            n >>= 7
            if n > 0:
                out.append(b | 0x80)
            else:
                out.append(b)
                break

    @classmethod
    def _protobuf_encode(cls, fields: list[tuple[int, bytes]]) -> bytes:
        result = bytearray()
        for num, value in fields:
            cls._varint((num << 3) | 2, result)
            cls._varint(len(value), result)
            result += value
        return bytes(result)

    @classmethod
    def _reload_protobuf(cls, version: str, anchor: str) -> bytes:
        return cls._protobuf_encode(
            [
                (1, version.encode()),
                (2, anchor.encode()),
                (6, b"fi"),
                (14, cls.RECAPTCHA_SITE_KEY.encode()),
            ]
        )

    @classmethod
    def _parse_google_payload(cls, text: str) -> list:
        body = text.strip()
        if body.startswith(")]}'"):
            body = body.split("\n", 1)[1]
        return json.loads(body)

    @classmethod
    def _recaptcha_session(cls) -> requests.Session:
        sess = requests.Session()
        sess.headers.update(
            {
                "User-Agent": cls.RECAPTCHA_USER_AGENT,
                "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            }
        )
        return sess

    @classmethod
    def _recaptcha_version(cls, sess: requests.Session) -> str:
        r = sess.get(
            "https://www.google.com/recaptcha/api.js",
            headers={"User-Agent": cls.RECAPTCHA_USER_AGENT},
            timeout=30,
        )
        r.raise_for_status()
        match = re.search(r"/recaptcha/releases/(.+?)/", r.text)
        if not match:
            raise RuntimeError("Google reCAPTCHA version not found.")
        return match.group(1)

    @classmethod
    def _recaptcha_anchor(cls, sess: requests.Session, version: str) -> str:
        co = cls._rc_base64(cls.RECAPTCHA_SITE_URL)
        url = (
            "https://www.google.com/recaptcha/api2/anchor"
            f"?ar=1&k={cls.RECAPTCHA_SITE_KEY}&co={co}&hl=tr&v={version}&size=normal"
        )
        r = sess.get(url, timeout=30)
        r.raise_for_status()
        match = re.search(r'id="recaptcha-token"\s+value="([^"]+)"', r.text)
        if not match:
            raise RuntimeError("Google reCAPTCHA anchor token not found.")
        return match.group(1)

    @classmethod
    def _recaptcha_reload(cls, sess: requests.Session, version: str, anchor: str) -> str:
        body = cls._reload_protobuf(version, anchor)
        r = sess.post(
            f"https://www.google.com/recaptcha/api2/reload?k={cls.RECAPTCHA_SITE_KEY}",
            data=body,
            headers={
                "Content-Type": "application/x-protobuffer",
                "Origin": "https://www.google.com",
                "Referer": (
                    "https://www.google.com/recaptcha/api2/bframe"
                    f"?hl=tr&v={version}&k={cls.RECAPTCHA_SITE_KEY}"
                ),
            },
            timeout=30,
        )
        r.raise_for_status()
        payload = cls._parse_google_payload(r.text)
        token = payload[1] if isinstance(payload, list) and len(payload) > 1 else None
        if not token or not str(token).startswith("0cAFcWeA"):
            raise RuntimeError(f"Google reCAPTCHA reload failed: {payload[:6]}")
        return str(token)

    @classmethod
    def _recaptcha_userverify(cls, sess: requests.Session, version: str, reload_token: str) -> str:
        r = sess.post(
            f"https://www.google.com/recaptcha/api2/userverify?k={cls.RECAPTCHA_SITE_KEY}",
            data={
                "v": version,
                "c": reload_token,
                "response": cls.RECAPTCHA_RESPONSE_BLOB,
                "t": "0",
                "ct": "0",
                "bg": "!",
            },
            headers={
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "Origin": "https://www.google.com",
                "Referer": (
                    "https://www.google.com/recaptcha/api2/bframe"
                    f"?hl=tr&v={version}&k={cls.RECAPTCHA_SITE_KEY}"
                ),
            },
            timeout=30,
        )
        r.raise_for_status()
        payload = cls._parse_google_payload(r.text)
        token = payload[1] if isinstance(payload, list) and len(payload) > 1 else None
        if not token or not str(token).startswith("0cAFcWeA"):
            raise RuntimeError(f"Google reCAPTCHA userverify failed: {payload[:4]}")
        return str(token)

    @classmethod
    def resolve_captcha(cls) -> str:
        sess = cls._recaptcha_session()
        version = cls._recaptcha_version(sess)
        anchor = cls._recaptcha_anchor(sess, version)
        reload_tok = cls._recaptcha_reload(sess, version, anchor)
        return cls._recaptcha_userverify(sess, version, reload_tok)

    @staticmethod
    def _is_captcha_failure(result: dict) -> bool:
        if not isinstance(result, dict) or result.get("success") is not False:
            return False
        msg = str(result.get("message") or result.get("reason") or "").lower()
        return any(x in msg for x in ("doğrulama", "dogrulama", "görsel", "gorsel", "captcha"))

    # --- adres API ---

    def il_list(self):
        r = self.sess.post(self.il_url, data="")
        return self.return_logic(r)

    def _post_with_captcha(self, url, fields):
        last = None
        for _ in range(2):
            try:
                captcha = self.resolve_captcha()
            except RuntimeError as exc:
                return {"success": False, "reason": str(exc)}
            data = dict(fields)
            data["adresReCaptchaResponse"] = captcha
            r = self.sess.post(url, data=urlencode(data))
            last = self.return_logic(r)
            if not self._is_captcha_failure(last):
                return last
        return last

    def ilce_list(self, ilKimlikNo):
        return self._post_with_captcha(self.ilce_url, {"ilKimlikNo": ilKimlikNo})

    def mahalle_list(self, ilceKimlikNo):
        return self._post_with_captcha(self.mahalle_url, {"ilceKimlikNo": ilceKimlikNo})

    def yol_list(self, mahalleKoyBaglisiKimlikNo):
        return self._post_with_captcha(
            self.yol_url, {"mahalleKoyBaglisiKimlikNo": mahalleKoyBaglisiKimlikNo}
        )

    def bina_list(self, mahalleKoyBaglisiKimlikNo, yolKimlikNo):
        return self._post_with_captcha(
            self.bina_url,
            {
                "mahalleKoyBaglisiKimlikNo": mahalleKoyBaglisiKimlikNo,
                "yolKimlikNo": yolKimlikNo,
            },
        )

    def bagimsizbolum_list(self, mahalleKoyBaglisiKimlikNo, binaKimlikNo):
        return self._post_with_captcha(
            self.bagimsizbolum_url,
            {
                "mahalleKoyBaglisiKimlikNo": mahalleKoyBaglisiKimlikNo,
                "binaKimlikNo": binaKimlikNo,
            },
        )

    def acik_adres(self, mahalleKoyBaglisiKimlikNo, bagimsizBolumKayitNo):
        return self._post_with_captcha(
            self.acikadres_url,
            {
                "bagimsizBolumKayitNo": bagimsizBolumKayitNo,
                "bagimsizBolumAdresNo": mahalleKoyBaglisiKimlikNo,
            },
        )

    def return_logic(self, r):
        try:
            data = r.json()
            if isinstance(data, dict):
                if "success" in data.keys() and data.get("success") is False:
                    return data
            return {"success": True, "data": data}
        except Exception as e:
            return {"success": False, "reason": str(e)}


NVI_RECAPTCHA_SITE_KEY = NviHandler.RECAPTCHA_SITE_KEY
