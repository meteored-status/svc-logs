#!/bin/bash
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO=${1}

getPackageConfigValue() {
  local WORKSPACE=${1}
  local CONFIG=${2}

  ./jq -r ".config.${CONFIG}" "services/${WORKSPACE}/package.json"
}
export -f getPackageConfigValue

parseWorkspace() {
  local PROYECTO=${1}
  local ENTORNO=${2}
  local WORKSPACE=${3}

  GENERAR=$(getPackageConfigValue "${WORKSPACE}" "generar")
  DEPLOY=$(getPackageConfigValue "${WORKSPACE}" "deploy")
  RUNTIME=$(getPackageConfigValue "${WORKSPACE}" "runtime")
  KUSTOMIZER=$(getPackageConfigValue "${WORKSPACE}" "kustomize")

  if [[ ${GENERAR} == "true" ]]; then
    if [[ ${DEPLOY} == "true" ]]; then
      if [[ ${RUNTIME} == "browser" ]]; then
        echo "Tags: ${WORKSPACE} => NO"
        return
      fi

      echo "Obteniendo tags para \"${WORKSPACE}\""
      gcloud container images list-tags "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}" --filter="tags~^${ENTORNO}" --format=json > "services/${WORKSPACE}/tags.json"
    fi
  fi
}
export -f parseWorkspace

ls services | xargs -I '{}' -P 1 bash -c "parseWorkspace $PROYECTO $ENTORNO {}"
