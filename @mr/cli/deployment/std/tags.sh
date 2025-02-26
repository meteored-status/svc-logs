#!/bin/bash
set -e

getPackageConfigValue() {
  local DIRECTORIO=${1}
  local WORKSPACE=${2}
  local CONFIG=${3}

  ./jq -r "${CONFIG}" "${DIRECTORIO}/${WORKSPACE}/mrpack.json"
}
export -f getPackageConfigValue

parseWorkspace() {
  local DIRECTORIO=${1}
  local WORKSPACE=${2}

  GENERAR=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" ".enabled")
  DEPLOY=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" ".deploy.enabled")
  RUNTIME=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" ".deploy.runtime")
  KUSTOMIZER=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" ".deploy.kustomize")

  if [[ ${GENERAR} == "true" ]]; then
    if [[ ${DEPLOY} == "true" ]]; then
      if [[ ${RUNTIME} == "browser" ]]; then
        echo "Tags: ${WORKSPACE} => NO"
      else
        echo "Obteniendo tags para \"${WORKSPACE}\""
        gcloud container images list-tags "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}" --filter="tags~^${_ENTORNO}" --format=json > "${DIRECTORIO}/${WORKSPACE}/tags.json"
        gcloud container images list-tags "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}" --filter="tags~^deployed_${_ENTORNO}" --format=json > "${DIRECTORIO}/${WORKSPACE}/deployed.json"
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 1 bash -c "parseWorkspace cronjobs {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 1 bash -c "parseWorkspace services {}"
fi
