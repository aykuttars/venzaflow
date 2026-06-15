"""Minimal SOAP client for Medula sağlık tesisi e-Reçete web servisi."""

from __future__ import annotations

import base64
from typing import Any
from xml.etree import ElementTree as ET

import requests

from apps.integrations.authority.medula_constants import NS, SERVICE_URLS

SOAP_ENV = "http://schemas.xmlsoap.org/soap/envelope/"


class MedulaSoapError(Exception):
    def __init__(self, message: str, *, payload: Any = None) -> None:
        super().__init__(message)
        self.payload = payload


class MedulaSoapClient:
    def __init__(
        self,
        *,
        username: str,
        password: str,
        environment: str = "test",
        timeout: int = 45,
    ) -> None:
        self.username = username
        self.password = password
        self.environment = environment if environment in SERVICE_URLS else "test"
        self.service_url = SERVICE_URLS[self.environment]
        self.timeout = timeout

    def _post(self, action: str, body_inner: str) -> ET.Element:
        envelope = (
            f'<?xml version="1.0" encoding="UTF-8"?>'
            f'<soapenv:Envelope xmlns:soapenv="{SOAP_ENV}" xmlns:ser="{NS}">'
            f"<soapenv:Header/>"
            f"<soapenv:Body>{body_inner}</soapenv:Body>"
            f"</soapenv:Envelope>"
        )
        headers = {
            "Content-Type": "text/xml; charset=utf-8",
            "SOAPAction": action,
        }
        try:
            resp = requests.post(
                self.service_url,
                data=envelope.encode("utf-8"),
                headers=headers,
                auth=(self.username, self.password),
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise MedulaSoapError(f"Medula bağlantı hatası: {exc}", payload={"retryable": True}) from exc

        if resp.status_code >= 500:
            raise MedulaSoapError(
                f"Medula sunucu hatası: HTTP {resp.status_code}",
                payload={"status_code": resp.status_code, "text": resp.text[:2000], "retryable": True},
            )
        if resp.status_code >= 400:
            raise MedulaSoapError(
                f"Medula HTTP hatası: {resp.status_code}",
                payload={"status_code": resp.status_code, "text": resp.text[:2000]},
            )

        try:
            root = ET.fromstring(resp.content)
        except ET.ParseError as exc:
            raise MedulaSoapError(
                "Medula yanıtı XML olarak okunamadı.",
                payload={"text": resp.text[:2000]},
            ) from exc
        return root

    @staticmethod
    def _local(tag: str) -> str:
        return f"{{{NS}}}{tag}"

    def _find_text(self, root: ET.Element, tag: str) -> str:
        node = root.find(f".//{self._local(tag)}")
        return (node.text or "").strip() if node is not None else ""

    def test_connection(
        self,
        *,
        tesis_kodu: int,
        doktor_tc: str,
        hasta_tc: str | None = None,
    ) -> tuple[bool, str]:
        tc = (hasta_tc or "22222222220").strip()
        try:
            tesis = int(tesis_kodu)
            doktor = int(doktor_tc)
            hasta = int(tc)
        except ValueError:
            return False, "Geçersiz TCKN/tesis kodu formatı."

        body = (
            f"<ser:ereceteListeSorgu>"
            f"<arg0>"
            f"<tesisKodu>{tesis}</tesisKodu>"
            f"<doktorTcKimlikNo>{doktor}</doktorTcKimlikNo>"
            f"<hastaTcKimlikNo>{hasta}</hastaTcKimlikNo>"
            f"</arg0>"
            f"</ser:ereceteListeSorgu>"
        )
        try:
            root = self._post("ereceteListeSorgu", body)
        except MedulaSoapError as exc:
            return False, str(exc)

        sonuc = self._find_text(root, "sonucKodu")
        mesaj = self._find_text(root, "sonucMesaji") or "Bağlantı başarılı."
        if sonuc == "0" or sonuc == "":
            return True, mesaj or "Medula test bağlantısı başarılı."
        return False, mesaj or f"Medula sonuç kodu: {sonuc}"

    def imzali_erecete_giris(
        self,
        *,
        signed_xml: bytes,
        tesis_kodu: int,
        doktor_tc: str,
        surum_numarasi: int = 1,
    ) -> dict[str, Any]:
        imzali_b64 = base64.b64encode(signed_xml).decode("ascii")
        body = (
            f"<ser:imzaliEreceteGiris>"
            f"<arg0>"
            f"<imzaliErecete>{imzali_b64}</imzaliErecete>"
            f"<tesisKodu>{int(tesis_kodu)}</tesisKodu>"
            f"<surumNumarasi>{int(surum_numarasi)}</surumNumarasi>"
            f"<doktorTcKimlikNo>{int(doktor_tc)}</doktorTcKimlikNo>"
            f"</arg0>"
            f"</ser:imzaliEreceteGiris>"
        )
        root = self._post("imzaliEreceteGiris", body)
        sonuc = self._find_text(root, "sonucKodu")
        mesaj = self._find_text(root, "sonucMesaji")
        uyari = self._find_text(root, "uyariMesaji")
        erecete_no = self._find_text(root, "ereceteNo")
        payload = {
            "sonucKodu": sonuc,
            "sonucMesaji": mesaj,
            "uyariMesaji": uyari,
            "ereceteNo": erecete_no,
        }
        if sonuc != "0":
            raise MedulaSoapError(
                mesaj or f"Medula reçete girişi reddedildi (kod {sonuc}).",
                payload=payload,
            )
        return payload
