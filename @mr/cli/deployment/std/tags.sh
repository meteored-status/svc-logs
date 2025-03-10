#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

parseWorkspace() {
  RUTA="${1}"
  WORKSPACE=$(path2 "${RUTA}")

  KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

  echo "Obteniendo tags para \"${WORKSPACE}\""
  gcloud container images list-tags "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}" --filter="tags~^${_ENTORNO}" --format=json > "${RUTA}/tags.json"
  gcloud container images list-tags "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}" --filter="tags~^deployed_${_ENTORNO}" --format=json > "${RUTA}/deployed.json"
}
export -f parseWorkspace

lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
wait
