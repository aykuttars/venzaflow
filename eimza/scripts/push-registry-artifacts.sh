#!/usr/bin/env bash
# Push and cosign e-imza installers to the OCI artifact registry.
# macOS/Linux: glob patterns from ARTIFACT_GLOBS (Bash 3.2 safe, proven on macOS runners).
# Windows: bash globs in-script (env vars strip '*'; find is Windows find.exe, not GNU find).
set -euo pipefail

: "${REGISTRY:?}"
: "${REGISTRY_REPO:?}"
: "${VERSION:?}"
: "${PLATFORM:?}"
: "${ARCH:?}"
: "${MIN_OS_VERSION:?}"
: "${MIN_OS_LABEL:?}"
: "${REGISTRY_USER:?}"
: "${REGISTRY_PASS:?}"
: "${COSIGN_PRIVATE_KEY:?}"
: "${COSIGN_PASSWORD:?}"

echo "$REGISTRY_PASS" | oras login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin
echo "$REGISTRY_PASS" | cosign login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin

case "$PLATFORM" in
  mac) OCI_OS=darwin ;;
  win) OCI_OS=windows ;;
  linux) OCI_OS=linux ;;
  *) OCI_OS="$PLATFORM" ;;
esac

case "$ARCH" in
  x64) OCI_ARCH=amd64 ;;
  arm64) OCI_ARCH=arm64 ;;
  *) OCI_ARCH="$ARCH" ;;
esac

# mktemp paths break ORAS on Windows (GetFileAttributesEx on missing tmp/...).
push_dir="release/.registry-push"
mkdir -p "$push_dir"
oci_config="$push_dir/oci-config.json"
pushed_file="$push_dir/pushed-tags.txt"
printf '{"architecture":"%s","os":"%s","os.version":"%s"}\n' \
  "$OCI_ARCH" "$OCI_OS" "$MIN_OS_VERSION" > "$oci_config"
: > "$pushed_file"
trap 'rm -rf "$push_dir"' EXIT

oras_local_path() {
  local path="$1"
  path="${path//\\//}"
  if [ "$PLATFORM" = "win" ] && command -v cygpath >/dev/null 2>&1; then
    cygpath -m "$path"
  else
    printf '%s' "$path"
  fi
}

push_installer() {
  local file="$1"
  [ -f "$file" ] || return 0

  local name tag ref
  name="$(basename "$file")"
  case "$name" in
    *.blockmap|*.yml|*.yaml) return 0 ;;
  esac

  tag="${VERSION}-${PLATFORM}-${ARCH}-${name}"
  if grep -Fxq "$tag" "$pushed_file" 2>/dev/null; then
    return 0
  fi
  echo "$tag" >> "$pushed_file"

  ref="${REGISTRY}/${REGISTRY_REPO}:${tag}"
  local installer_path config_path
  installer_path="$(oras_local_path "$file")"
  config_path="$(oras_local_path "$oci_config")"
  echo ">> Pushing ${ref} (${installer_path})"
  oras push "$ref" \
    "${installer_path}:application/octet-stream" \
    --config "${config_path}:application/vnd.oci.image.config.v1+json" \
    --annotation "org.opencontainers.image.title=Venzaflow e-imza" \
    --annotation "org.opencontainers.image.version=${VERSION}" \
    --annotation "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --annotation "org.opencontainers.image.vendor=Venzaflow" \
    --annotation "org.opencontainers.image.authors=aykutt" \
    --annotation "org.opencontainers.image.source=https://github.com/venzaflow/venzaflow" \
    --annotation "org.opencontainers.image.description=Venzaflow e-imza — minimum: ${MIN_OS_LABEL} (Electron 39)" \
    --annotation "org.opencontainers.image.os=${OCI_OS}" \
    --annotation "org.opencontainers.image.arch=${OCI_ARCH}" \
    --annotation "com.venzaflow.eimza.min-os=${MIN_OS_LABEL}" \
    --annotation "land.oras.artifact.platform.osversion=${MIN_OS_VERSION}"
  echo ">> Signing ${ref}"
  echo "$COSIGN_PASSWORD" | cosign sign --yes --tlog-upload=false \
    --key "env://COSIGN_PRIVATE_KEY" \
    "$ref"
}

found=0

if [ "$PLATFORM" = "win" ]; then
  shopt -s nullglob
  for file in release/*.exe; do
    found=1
    push_installer "$file"
  done
  shopt -u nullglob
else
  : "${ARTIFACT_GLOBS:?ARTIFACT_GLOBS is required for macOS/Linux publish}"
  shopt -s nullglob
  while IFS= read -r pattern; do
    pattern="${pattern#"${pattern%%[![:space:]]*}"}"
    pattern="${pattern%"${pattern##*[![:space:]]}"}"
    [ -z "$pattern" ] && continue
    for file in $pattern; do
      found=1
      push_installer "$file"
    done
  done <<< "$ARTIFACT_GLOBS"
fi

if [ "$found" -eq 0 ]; then
  echo "No installer files found under release/" >&2
  ls -la release/ || true
  exit 1
fi
