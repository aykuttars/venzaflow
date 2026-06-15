"""XAdES-BES enveloping signature for Medula e-Reçete.

Medula expects the unsigned erecete XML base64-encoded inside ds:Object and
the whole Signature element returned as UTF-8 bytes to ``imzaliEreceteGiris``.
"""

from __future__ import annotations

import base64
import hashlib
import uuid
from dataclasses import dataclass

from cryptography.x509 import load_der_x509_certificate
from lxml import etree

from apps.signing.services.xades import DS, EXC_C14N, RSA_SHA256, SHA256, SIGNED_PROPS_TYPE, XADES

BASE64_TRANSFORM = "http://www.w3.org/2000/09/xmldsig#base64"
SIG_NSMAP = {"ds": DS, "xades": XADES}


@dataclass
class MedulaXadesPrepared:
    signed_info_c14n: bytes
    signed_document_template: bytes


def _c14n(element: etree._Element) -> bytes:
    return etree.tostring(element, method="c14n", exclusive=True, with_comments=False)


def _sha256_b64(data: bytes) -> str:
    return base64.b64encode(hashlib.sha256(data).digest()).decode("ascii")


def _ds(parent, tag: str, text: str | None = None, **attrs) -> etree._Element:
    node = etree.SubElement(parent, f"{{{DS}}}{tag}", **attrs)
    if text is not None:
        node.text = text
    return node


def _xades(parent, tag: str, text: str | None = None, **attrs) -> etree._Element:
    node = etree.SubElement(parent, f"{{{XADES}}}{tag}", **attrs)
    if text is not None:
        node.text = text
    return node


def prepare_enveloping_xades(
    payload_xml: bytes, cert_der: bytes, *, signing_time: str
) -> MedulaXadesPrepared:
    suffix = uuid.uuid4().hex[:12]
    sig_id = f"Signature_{suffix}"
    sp_id = f"SignedProperties_{suffix}"
    obj_id = "erecete"

    payload_b64 = base64.b64encode(payload_xml).decode("ascii")

    signature = etree.Element(f"{{{DS}}}Signature", nsmap=SIG_NSMAP)
    signature.set("Id", sig_id)

    signed_info = _ds(signature, "SignedInfo")
    _ds(signed_info, "CanonicalizationMethod", Algorithm=EXC_C14N)
    _ds(signed_info, "SignatureMethod", Algorithm=RSA_SHA256)

    ref_doc = _ds(signed_info, "Reference", URI=f"#{obj_id}")
    transforms = _ds(ref_doc, "Transforms")
    _ds(transforms, "Transform", Algorithm=BASE64_TRANSFORM)
    _ds(ref_doc, "DigestMethod", Algorithm=SHA256)
    doc_digest = _sha256_b64(payload_xml)
    _ds(ref_doc, "DigestValue", doc_digest)

    ref_sp = _ds(signed_info, "Reference", URI=f"#{sp_id}", Type=SIGNED_PROPS_TYPE)
    transforms_sp = _ds(ref_sp, "Transforms")
    _ds(transforms_sp, "Transform", Algorithm=EXC_C14N)
    _ds(ref_sp, "DigestMethod", Algorithm=SHA256)
    sp_digest_node = _ds(ref_sp, "DigestValue")

    _ds(signature, "SignatureValue")

    key_info = _ds(signature, "KeyInfo")
    x509_data = _ds(key_info, "X509Data")
    _ds(x509_data, "X509Certificate", base64.b64encode(cert_der).decode("ascii"))

    payload_obj = _ds(
        signature,
        "Object",
        Id=obj_id,
        MimeType="text/xml",
        Encoding=BASE64_TRANSFORM,
    )
    payload_obj.text = payload_b64

    qp_obj = _ds(signature, "Object")
    qp = _xades(qp_obj, "QualifyingProperties", Target=f"#{sig_id}")
    signed_props = _xades(qp, "SignedProperties")
    signed_props.set("Id", sp_id)
    ssp = _xades(signed_props, "SignedSignatureProperties")
    _xades(ssp, "SigningTime", signing_time)

    signing_cert = _xades(ssp, "SigningCertificate")
    cert_node = _xades(signing_cert, "Cert")
    cert_digest = _xades(cert_node, "CertDigest")
    _ds(cert_digest, "DigestMethod", Algorithm=SHA256)
    _ds(cert_digest, "DigestValue", _sha256_b64(cert_der))

    cert = load_der_x509_certificate(cert_der)
    issuer_serial = _xades(cert_node, "IssuerSerial")
    _ds(issuer_serial, "X509IssuerName", cert.issuer.rfc4514_string())
    _ds(issuer_serial, "X509SerialNumber", str(cert.serial_number))

    sp_digest_node.text = _sha256_b64(_c14n(signed_props))
    signed_info_c14n = _c14n(signed_info)

    template = etree.tostring(signature, xml_declaration=True, encoding="UTF-8", standalone=False)
    return MedulaXadesPrepared(
        signed_info_c14n=signed_info_c14n,
        signed_document_template=template,
    )


def inject_enveloping_signature(signed_document_template: bytes, signature: bytes) -> bytes:
    root = etree.fromstring(signed_document_template)
    sig_value = root.find(f"{{{DS}}}SignatureValue")
    if sig_value is None:
        raise ValueError("Şablonda ds:SignatureValue bulunamadı.")
    sig_value.text = base64.b64encode(signature).decode("ascii")
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=False)
