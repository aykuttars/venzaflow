from __future__ import annotations

import base64

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509 import load_der_x509_certificate


class SignatureVerificationError(Exception):
    pass


def verify_signature(
    certificate_der_base64: str,
    data: bytes,
    signature_base64: str,
    algorithm: str = "SHA256_RSA_PKCS",
) -> None:
    if algorithm != "SHA256_RSA_PKCS":
        raise SignatureVerificationError(f"Unsupported algorithm: {algorithm}")

    try:
        cert_der = base64.b64decode(certificate_der_base64)
        signature = base64.b64decode(signature_base64)
    except Exception as exc:
        raise SignatureVerificationError("Invalid base64 certificate or signature.") from exc

    try:
        certificate = load_der_x509_certificate(cert_der)
        public_key = certificate.public_key()
        public_key.verify(
            signature,
            data,
            padding.PKCS1v15(),
            hashes.SHA256(),
        )
    except InvalidSignature as exc:
        raise SignatureVerificationError("Signature verification failed.") from exc
    except Exception as exc:
        raise SignatureVerificationError(f"Certificate or signature error: {exc}") from exc
