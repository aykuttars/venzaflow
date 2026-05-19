#!/usr/bin/env bash
# Build, tag, and push all images to a private Docker registry.
# Usage:
#   REGISTRY=10.0.0.3:5000 TAG=latest ./docker/scripts/build-push.sh
#
# Env:
#   REGISTRY    target registry host:port      (default 10.0.0.3:5000)
#   TAG         image tag                       (default latest)
#   PROJECT     image name prefix              (default tenancysoft)
set -euo pipefail

REGISTRY="${REGISTRY:-10.0.0.3:5000}"
TAG="${TAG:-latest}"
PROJECT="${PROJECT:-tenancysoft}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo ">> Building backend"
docker build -t "${PROJECT}-api:${TAG}" "$ROOT/backend"
echo ">> Building frontend"
docker build -t "${PROJECT}-web:${TAG}" "$ROOT/frontend"

# Worker reuses the backend image; keep a friendly alias too.
docker tag "${PROJECT}-api:${TAG}" "${PROJECT}-worker:${TAG}"

for img in "${PROJECT}-api" "${PROJECT}-web" "${PROJECT}-worker"; do
  echo ">> Pushing ${img}:${TAG}"
  docker tag  "${img}:${TAG}" "${REGISTRY}/${img}:${TAG}"
  docker push "${REGISTRY}/${img}:${TAG}"
done

echo
echo "Done. Images on ${REGISTRY}:"
for img in "${PROJECT}-api" "${PROJECT}-web" "${PROJECT}-worker"; do
  echo "  ${REGISTRY}/${img}:${TAG}"
done
