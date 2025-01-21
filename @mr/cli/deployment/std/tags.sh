#!/bin/bash
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO=${1}

getPackageConfigValue() {
  local DIRECTORIO=${1}
  local WORKSPACE=${2}
  local CONFIG=${3}

  ./jq -r ".config.${CONFIG}" "${DIRECTORIO}/${WORKSPACE}/package.json"
}
export -f getPackageConfigValue

parseWorkspace() {
  local DIRECTORIO=${1}
  local PROYECTO=${2}
  local ENTORNO=${3}
  local WORKSPACE=${4}

  GENERAR=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" "generar")
  DEPLOY=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" "deploy")
  RUNTIME=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" "runtime")
  KUSTOMIZER=$(getPackageConfigValue "${DIRECTORIO}" "${WORKSPACE}" "kustomize")

  if [[ ${GENERAR} == "true" ]]; then
    if [[ ${DEPLOY} == "true" ]]; then
      if [[ ${RUNTIME} == "browser" ]]; then
        echo "Tags: ${WORKSPACE} => NO"
      else
        echo "Obteniendo tags para \"${WORKSPACE}\""
        gcloud container images list-tags "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}" --filter="tags~^${ENTORNO}" --format=json > "${DIRECTORIO}/${WORKSPACE}/tags.json"
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 1 bash -c "parseWorkspace cronjobs $PROYECTO $ENTORNO {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 1 bash -c "parseWorkspace services $PROYECTO $ENTORNO {}"
fi
