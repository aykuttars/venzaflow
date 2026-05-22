from __future__ import annotations

import base64
import json
import re
import threading
import time
from urllib.parse import urlencode

import requests
from bs4 import BeautifulSoup
from django.conf import settings


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

    _session_lock = threading.Lock()

    @staticmethod
    def _proxy_config() -> dict[str, str]:
        url = (getattr(settings, "NVI_PROXY_URL", "") or "").strip()
        if not url:
            return {}
        return {"http": url, "https": url}

    @classmethod
    def _apply_proxies(cls, sess: requests.Session) -> None:
        proxies = cls._proxy_config()
        if proxies:
            sess.proxies.update(proxies)

    def __init__(self) -> None:
        self.homepage_url = "https://adres.nvi.gov.tr/VatandasIslemleri/AdresSorgu"
        self.il_url = "https://adres.nvi.gov.tr/Harita/ilListesi"
        self.ilce_url = "https://adres.nvi.gov.tr/Harita/ilceListesi"
        self.mahalle_url = "https://adres.nvi.gov.tr/Harita/mahalleKoyBaglisiListesi"
        self.yol_url = "https://adres.nvi.gov.tr/Harita/yolListesi"
        self.bina_url = "https://adres.nvi.gov.tr/Harita/binaListesi"
        self.bagimsizbolum_url = "https://adres.nvi.gov.tr/Harita/bagimsizBolumListesi"
        self.acikadres_url = "https://adres.nvi.gov.tr/Harita/AcikAdres"
        self.request_timeout = int(getattr(settings, "NVI_REQUEST_TIMEOUT", 25))
        self.token = ""
        self.cookies: dict = {}
        self._captcha_token = ""
        self._captcha_until = 0.0
        self._captcha_lock = threading.Lock()
        self.sess = requests.Session()
        self._apply_proxies(self.sess)
        self.sess.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36"
                ),
            }
        )

    def _ensure_session(self) -> None:
        if self.token:
            return
        with self._session_lock:
            if self.token:
                return
            self.initialize_token()

    def initialize_token(self) -> None:
        r = self.sess.get(self.homepage_url, timeout=self.request_timeout)
        r.raise_for_status()
        soup = BeautifulSoup(r.content, "html.parser")
        field = soup.find("input", {"name": "__RequestVerificationToken"})
        if not field or not field.get("value"):
            raise RuntimeError("NVI verification token not found.")
        self.token = field.get("value")
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

    @staticmethod
    def _request_error(exc: Exception) -> dict:
        return {"success": False, "reason": f"NVI request failed: {exc}"}

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
        cls._apply_proxies(sess)
        sess.headers.update(
            {
                "User-Agent": cls.RECAPTCHA_USER_AGENT,
                "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            }
        )
        return sess

    @classmethod
    def _recaptcha_timeout(cls) -> int:
        return int(getattr(settings, "NVI_REQUEST_TIMEOUT", 25))

    @classmethod
    def _recaptcha_version(cls, sess: requests.Session) -> str:
        r = sess.get(
            "https://www.google.com/recaptcha/api.js",
            headers={"User-Agent": cls.RECAPTCHA_USER_AGENT},
            timeout=cls._recaptcha_timeout(),
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
        r = sess.get(url, timeout=cls._recaptcha_timeout())
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
            timeout=cls._recaptcha_timeout(),
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
            timeout=cls._recaptcha_timeout(),
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

    def _resolve_captcha_cached(self) -> str:
        ttl = int(getattr(settings, "NVI_CAPTCHA_CACHE_TTL", 120))
        now = time.monotonic()
        if self._captcha_token and now < self._captcha_until:
            return self._captcha_token
        with self._captcha_lock:
            now = time.monotonic()
            if self._captcha_token and now < self._captcha_until:
                return self._captcha_token
            token = self.resolve_captcha()
            self._captcha_token = token
            self._captcha_until = time.monotonic() + ttl
            return token

    @staticmethod
    def _is_captcha_failure(result: dict) -> bool:
        if not isinstance(result, dict) or result.get("success") is not False:
            return False
        msg = str(result.get("message") or result.get("reason") or "").lower()
        return any(x in msg for x in ("doğrulama", "dogrulama", "görsel", "gorsel", "captcha"))

    # --- adres API ---

    def il_list(self):
        try:
            self._ensure_session()
            r = self.sess.post(self.il_url, data="", timeout=self.request_timeout)
            return self.return_logic(r)
        except requests.RequestException as exc:
            return self._request_error(exc)

    def _post_with_captcha(self, url, fields):
        last = None
        try:
            self._ensure_session()
        except requests.RequestException as exc:
            return self._request_error(exc)
        for _ in range(2):
            try:
                captcha = self._resolve_captcha_cached()
            except (RuntimeError, requests.RequestException) as exc:
                return {"success": False, "reason": str(exc)}
            data = dict(fields)
            data["adresReCaptchaResponse"] = captcha
            try:
                r = self.sess.post(url, data=urlencode(data), timeout=self.request_timeout)
            except requests.RequestException as exc:
                return self._request_error(exc)
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
