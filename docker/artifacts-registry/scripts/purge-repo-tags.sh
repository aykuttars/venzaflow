#!/usr/bin/env bash
# Delete all tags/manifests from an OCI repo on the artifacts registry.
# Usage: ARTIFACT_REGISTRY_URL=... ARTIFACT_REGISTRY_REPO=... \
#        ARTIFACT_REGISTRY_USER=... ARTIFACT_REGISTRY_PASSWORD=... \
#        ./purge-repo-tags.sh
set -euo pipefail

: "${ARTIFACT_REGISTRY_URL:?}"
: "${ARTIFACT_REGISTRY_REPO:?}"
: "${ARTIFACT_REGISTRY_USER:?}"
: "${ARTIFACT_REGISTRY_PASSWORD:?}"

BASE="${ARTIFACT_REGISTRY_URL%/}"
REPO="${ARTIFACT_REGISTRY_REPO}"
AUTH=(-u "${ARTIFACT_REGISTRY_USER}:${ARTIFACT_REGISTRY_PASSWORD}")
ACCEPT='application/vnd.oci.image.manifest.v1+json, application/vnd.oci.image.index.v1+json'

tags_json="$(curl -fsS "${AUTH[@]}" "${BASE}/v2/${REPO}/tags/list")"
mapfile -t TAGS < <(python3 -c 'import json,sys; print("\n".join(json.load(sys.stdin).get("tags") or []))' <<<"$tags_json")

if [ "${#TAGS[@]}" -eq 0 ]; then
  echo "No tags in ${REPO}."
  exit 0
fi

echo "Found ${#TAGS[@]} tags in ${REPO}"

seen_file="$(mktemp)"
trap 'rm -f "$seen_file"' EXIT
deleted=0

for tag in "${TAGS[@]}"; do
  digest="$(
    curl -fsSI "${AUTH[@]}" \
      -H "Accept: ${ACCEPT}" \
      "${BASE}/v2/${REPO}/manifests/${tag}" \
      | awk -F': ' 'tolower($1)=="docker-content-digest"{print $2}' \
      | tr -d '\r'
  )"
  if [ -z "$digest" ]; then
    echo "ERROR: no digest for tag ${tag}" >&2
    exit 1
  fi
  if grep -Fxq "$digest" "$seen_file" 2>/dev/null; then
    echo "skip (digest already deleted): ${tag}"
    continue
  fi
  curl -fsS -o /dev/null -X DELETE "${AUTH[@]}" \
    -H "Accept: ${ACCEPT}" \
    "${BASE}/v2/${REPO}/manifests/${digest}"
  echo "$digest" >> "$seen_file"
  deleted=$((deleted + 1))
  echo "deleted: ${tag} (${digest})"
done

remaining="$(curl -fsS "${AUTH[@]}" "${BASE}/v2/${REPO}/tags/list")"
count="$(python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("tags") or []))' <<<"$remaining")"
echo "Done. Deleted ${deleted} manifests. Remaining tags: ${count}"
