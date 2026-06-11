"""XAdES-BES enveloped signature for UBL-TR (e-Fatura / e-Arşiv).

Two-phase design so the smart card never has to understand XML:

  1. ``prepare_xades(document_xml, cert_der)`` builds the full ds:Signature
     structure (SignedInfo + XAdES SignedProperties) with all digests filled
     except ds:SignatureValue, and returns the exclusively-canonicalized
     SignedInfo bytes. Those bytes are what the eimza desktop signs with the
     card using SHA256+RSA (PKCS#1 v1.5) — identical to the existing flow.

  2. ``inject_signature(template, signature)`` drops the returned signature
     into ds:SignatureValue, producing the final signed UBL document.

Canonicalization is exclusive C14N (http://www.w3.org/2001/10/xml-exc-c14n#),
matching GİB conventions. The document reference uses the enveloped-signature
transform, so signing does not perturb the digest of the document body.
"""

from __future__ import annotations

import base64
import hashlib
import uuid
from dataclasses import dataclass

from cryptography.x509 import load_der_x509_certificate
from lxml import etree

DS = "http://www.w3.org/2000/09/xmldsig#"
XADES = "http://uri.etsi.org/01903/v1.3.2#"
EXT = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"

EXC_C14N = "http://www.w3.org/2001/10/xml-exc-c14n#"
ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature"
RSA_SHA256 = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"
SHA256 = "http://www.w3.org/2001/04/xmlenc#sha256"
SIGNED_PROPS_TYPE = "http://uri.etsi.org/01903#SignedProperties"

SIG_NSMAP = {"ds": DS, "xades": XADES}


@dataclass
class XadesPrepared:
    #: Exclusive-C14N bytes of ds:SignedInfo — this is what the card signs.
    signed_info_c14n: bytes
    #: Full UBL document with ds:Signature inserted, SignatureValue still empty.
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


def _find_extension_content(root: etree._Element) -> etree._Element:
    node = root.find(f".//{{{EXT}}}ExtensionContent")
    if node is None:
        raise ValueError("UBL belgesinde ext:ExtensionContent bulunamadı.")
    return node


def prepare_xades(document_xml: bytes, cert_der: bytes, *, signing_time: str) -> XadesPrepared:
    root = etree.fromstring(document_xml)

    # 1) Document reference digest (enveloped): the signature is absent now, so
    #    canonicalizing the bare document equals the verifier's post-transform
    #    canonical form.
    doc_digest = _sha256_b64(_c14n(root))

    suffix = uuid.uuid4().hex[:12]
    sig_id = f"Signature_{suffix}"
    sp_id = f"SignedProperties_{suffix}"

    signature = etree.Element(f"{{{DS}}}Signature", nsmap=SIG_NSMAP)
    signature.set("Id", sig_id)

    signed_info = _ds(signature, "SignedInfo")
    _ds(signed_info, "CanonicalizationMethod", Algorithm=EXC_C14N)
    _ds(signed_info, "SignatureMethod", Algorithm=RSA_SHA256)

    # Reference: the whole document (enveloped).
    ref_doc = _ds(signed_info, "Reference", URI="")
    transforms = _ds(ref_doc, "Transforms")
    _ds(transforms, "Transform", Algorithm=ENVELOPED)
    _ds(transforms, "Transform", Algorithm=EXC_C14N)
    _ds(ref_doc, "DigestMethod", Algorithm=SHA256)
    _ds(ref_doc, "DigestValue", doc_digest)

    # Reference: the XAdES SignedProperties (digest filled after it exists).
    ref_sp = _ds(signed_info, "Reference", URI=f"#{sp_id}", Type=SIGNED_PROPS_TYPE)
    transforms_sp = _ds(ref_sp, "Transforms")
    _ds(transforms_sp, "Transform", Algorithm=EXC_C14N)
    _ds(ref_sp, "DigestMethod", Algorithm=SHA256)
    sp_digest_node = _ds(ref_sp, "DigestValue")

    _ds(signature, "SignatureValue")  # filled in inject_signature

    key_info = _ds(signature, "KeyInfo")
    x509_data = _ds(key_info, "X509Data")
    _ds(x509_data, "X509Certificate", base64.b64encode(cert_der).decode("ascii"))

    # XAdES qualifying properties.
    obj = _ds(signature, "Object")
    qp = _xades(obj, "QualifyingProperties", Target=f"#{sig_id}")
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

    # 2) Insert into the document so SignedProperties canonicalizes in-context.
    extension_content = _find_extension_content(root)
    extension_content.append(signature)

    # 3) Now that SignedProperties lives in the tree, digest it and patch the
    #    second reference, then canonicalize SignedInfo for signing.
    sp_digest_node.text = _sha256_b64(_c14n(signed_props))
    signed_info_c14n = _c14n(signed_info)

    template = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=False)
    return XadesPrepared(signed_info_c14n=signed_info_c14n, signed_document_template=template)


def inject_signature(signed_document_template: bytes, signature: bytes) -> bytes:
    root = etree.fromstring(signed_document_template)
    sig_value = root.find(f".//{{{DS}}}SignatureValue")
    if sig_value is None:
        raise ValueError("Şablonda ds:SignatureValue bulunamadı.")
    sig_value.text = base64.b64encode(signature).decode("ascii")
    return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=False)
