#!/usr/bin/env bash
# Build, tag, and push all images to a private Docker registry.
# Usage:
#   REGISTRY=10.0.0.3:5000 TAG=latest ENVIRONMENT=prod ./docker/scripts/build-push.sh
#
# Env:
#   REGISTRY     target registry host:port      (default 10.0.0.3:5000)
#   TAG          image tag                       (default latest)
#   PROJECT      image name prefix              (default venzaflow)
#   ENVIRONMENT  dev|prod — suffix on image names (default prod)
set -euo pipefail

REGISTRY="${REGISTRY:-10.0.0.3:5000}"
TAG="${TAG:-latest}"
PROJECT="${PROJECT:-venzaflow}"
ENVIRONMENT="${ENVIRONMENT:-prod}"
ENV_SUFFIX="_${ENVIRONMENT}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo ">> Building API (shared image for api / celery / celery-beat)"
docker build -t "${PROJECT}-api${ENV_SUFFIX}:${TAG}" "$ROOT/backend"

docker tag "${PROJECT}-api${ENV_SUFFIX}:${TAG}" "${PROJECT}-celery${ENV_SUFFIX}:${TAG}"
docker tag "${PROJECT}-api${ENV_SUFFIX}:${TAG}" "${PROJECT}-celery-beat${ENV_SUFFIX}:${TAG}"

echo ">> Building web"
docker build -t "${PROJECT}-web${ENV_SUFFIX}:${TAG}" "$ROOT/frontend"

for img in "${PROJECT}-api" "${PROJECT}-celery" "${PROJECT}-celery-beat" "${PROJECT}-web"; do
  full="${img}${ENV_SUFFIX}"
  echo ">> Pushing ${full}:${TAG}"
  docker tag "${full}:${TAG}" "${REGISTRY}/${full}:${TAG}"
  docker push "${REGISTRY}/${full}:${TAG}"
done

echo
echo "Done. Images on ${REGISTRY} (ENVIRONMENT=${ENVIRONMENT}):"
for img in "${PROJECT}-api" "${PROJECT}-celery" "${PROJECT}-celery-beat" "${PROJECT}-web"; do
  echo "  ${REGISTRY}/${img}${ENV_SUFFIX}:${TAG}"
done
