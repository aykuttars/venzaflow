from __future__ import annotations

import json
import xml.etree.ElementTree as ET

import requests


class NviIdentityHandler:
    """TCKN, yabanci kimlik no ve vergi no dogrulama."""

    _KPS_URL = "https://tckimlik.nvi.gov.tr/Service/KPSPublic.asmx?WSDL"
    _KPS_NS = {
        "soap": "http://www.w3.org/2003/05/soap-envelope",
        "a": "http://tckimlik.nvi.gov.tr/WS",
    }

    @staticmethod
    def confirm_tckn(name: str, surname: str, tcno: str, byear: int):
        body = f"""<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <TCKimlikNoDogrula xmlns="http://tckimlik.nvi.gov.tr/WS">
      <TCKimlikNo>{int(tcno)}</TCKimlikNo>
      <Ad>{name}</Ad>
      <Soyad>{surname}</Soyad>
      <DogumYili>{int(byear)}</DogumYili>
    </TCKimlikNoDogrula>
  </soap12:Body>
</soap12:Envelope>"""
        r = requests.post(
            NviIdentityHandler._KPS_URL,
            data=body.encode("utf-8"),
            headers={"Content-Type": "application/soap+xml"},
            timeout=30,
        )
        if not r.ok:
            return {"success": False, "reason": r.reason}
        try:
            tree = ET.fromstring(r.content)
            node = tree.find(
                "./soap:Body/a:TCKimlikNoDogrulaResponse/a:TCKimlikNoDogrulaResult",
                NviIdentityHandler._KPS_NS,
            )
            if node is None or node.text is None:
                return {"success": False, "reason": f"unexpected response: {r.content[:300]!r}"}
            return {"success": True, "response": {"success": node.text.lower() == "true"}}
        except ET.ParseError as exc:
            return {"success": False, "reason": f"couldnt parse response: {exc}"}

    @staticmethod
    def confirm_foreign(name: str, surname: str, foreign_id: str, birth_date: str):
        bd_year, bd_month, bd_day = birth_date.split(".")
        api_url = "https://tckimlik.nvi.gov.tr/yabanciKimlikNoDogrula/search"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0",
            "Accept": "Application/Json",
            "Accept-Encoding": "gzip,deflate,br,utf-8",
            "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "Content-Type": "Application/Json",
        }
        jp = {
            "ybkn": foreign_id,
            "name": name.encode("utf-8").decode("latin-1"),
            "surname": surname.encode("utf-8").decode("latin-1"),
            "day": bd_day,
            "month": bd_month,
            "year": bd_year,
        }
        payload = (
            '{"YbKimlikNo": "%s", "Ad": "%s",  "Soyad": "%s","DogumGun": "%s","DogumAy": "%s","DogumYil": "%s"}'
            % (jp["ybkn"], jp["name"], jp["surname"], jp["day"], jp["month"], jp["year"])
        )
        r = requests.post(api_url, data=payload, headers=headers)
        if r.ok:
            return {"success": True, "response": json.loads(r.content)}
        return {"success": False, "reason": r.reason}

    @staticmethod
    def tax_no_confirm(tax_office, tax_no, kimlik_no):
        api_url = "https://intvrg.gib.gov.tr/intvrg_server/dispatch"
        headers = {
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Accept-Encoding": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
            "accept-language": "gzip, deflate",
        }
        jp = {
            "vergidaireleri": str(tax_office).rjust(6, "0"),
            "vkn1": tax_no,
            "tckn": "",
            "tckn1": kimlik_no,
        }
        payload = (
            'cmd=vergiNoIslemleri_vergiNumarasiSorgulama&callid=fd11433f1e007-14&token=d1078f5e3dc646b78d5d4e5842f21e97feb48d366bc7617458b6679dec12675154a01fccc42292bb04d926bc259dbc75e39dd8e202535fd70a7098396c74a6f7&jp={"dogrulama":'
            ' {"iller": "", "vergidaireleri": "%s", "vkn1": "%s",  "tckn1": "%s","tckn": ""}}'
            % (jp["vergidaireleri"], jp["vkn1"], jp["tckn1"])
        )
        r = requests.post(api_url, data=payload, headers=headers)
        if r.ok:
            return {"success": True, "response": json.loads(r.content)}
        return {"success": False, "reason": r.reason}


taxNoConfirm = NviIdentityHandler.tax_no_confirm
nviConfirm = NviIdentityHandler.confirm_tckn
foreingNviConfirm = NviIdentityHandler.confirm_foreign
