#!/usr/bin/env bash
# Cosign key pair oluştur + public key'i Zot'a yükle (bir kez).
#
#   cd docker/artifacts-registry
#   ./scripts/setup-cosign.sh
#
# Sonra:
#   cosign.pub  → sunucuda sakla
#   cosign.key  → GitHub secret COSIGN_PRIVATE_KEY (tüm içerik)
#   şifre       → GitHub secret COSIGN_PASSWORD
#
# Zot config güncelledikten sonra stack restart gerekir.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY_DIR="${ROOT}/cosign"
REGISTRY="${REGISTRY:-artifacts.aykut.io}"

mkdir -p "$KEY_DIR"

if [[ ! -f "${KEY_DIR}/cosign.key" ]]; then
  echo "Cosign key pair oluşturuluyor..."
  COSIGN_PASSWORD="${COSIGN_PASSWORD:-}" cosign generate-key-pair --output-key-prefix "${KEY_DIR}/cosign"
fi

echo
echo "Public key Zot'a yükleniyor: ${REGISTRY}"
read -r -p "Registry user [aykutt]: " REGISTRY_USER
REGISTRY_USER="${REGISTRY_USER:-aykutt}"
read -r -s -p "Registry password: " REGISTRY_PASS
echo

curl -fsS -u "${REGISTRY_USER}:${REGISTRY_PASS}" \
  --data-binary @"${KEY_DIR}/cosign.pub" \
  -X POST "https://${REGISTRY}/v2/_zot/ext/cosign"

echo
echo "Tamam."
echo "GitHub secrets:"
echo "  COSIGN_PRIVATE_KEY = ${KEY_DIR}/cosign.key içeriği"
echo "  COSIGN_PASSWORD    = key oluştururken verdiğin şifre"
