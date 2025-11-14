#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

parseWorkspace() {
  RUTA="${1}"
  WORKSPACE=$(path2 "${RUTA}")

#  KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)
  REGISTRO=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .registro // empty")
  if [[ -z "${REGISTRO}" || "${REGISTRO}" == "null" ]]; then
    REGISTRO="europe-west1-docker.pkg.dev"
  fi
  PAQUETE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .paquete // empty")
  if [[ -z "${PAQUETE}" || "${PAQUETE}" == "null" ]]; then
    PAQUETE="services"
  fi
  NOMBRE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .nombre // empty")
  if [[ -z "${NOMBRE}" || "${NOMBRE}" == "null" ]]; then
    NOMBRE="${WORKSPACE}"
  fi

  echo "Obteniendo tags para \"${WORKSPACE}\""
  gcloud container images list-tags "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}" --filter="tags~^${_ENTORNO}" --format=json > "${RUTA}/tags.json"
  gcloud container images list-tags "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}" --filter="tags~^deployed_${_ENTORNO}" --format=json > "${RUTA}/deployed.json"
}
export -f parseWorkspace

lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
wait
