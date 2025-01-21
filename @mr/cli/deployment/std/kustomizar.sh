#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO="${1}"

parseWorkspace() {
  local DIRECTORIO="${1}"
  local PROYECTO="${2}"
  local ENTORNO="${3}"
  local WORKSPACE="${4}"

  echo "Kustomizando ${WORKSPACE}"
  ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "echo \"# ${WORKSPACE}\" > ${DIRECTORIO}/${WORKSPACE}/despliegue_{}.yaml"

  if [[ $(./jq -r '.config.generar' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "${DIRECTORIO}/${WORKSPACE}/package.json") != "browser" ]]; then
        SERVICIOS=$(./jq -r '.servicio | if type == "array" then .[] else . end' "${DIRECTORIO}/${WORKSPACE}/package.json")
        VERSION=$(cat "${DIRECTORIO}/${WORKSPACE}/version.txt" || echo "0000.00.00")
        BASETOP=$(pwd)
        KUSTOMIZER=$(./jq -r '.config.kustomize' "${DIRECTORIO}/${WORKSPACE}/package.json")


        parseWorkspaceEjecutar() {
          local DIRECTORIO="${1}"
          local PROYECTO="${2}"
          local WORKSPACE="${3}"
          local SERVICIO="${4}"
          local VERSION="${5}"
          local BASETOP="${6}"
          local KUSTOMIZER="${7}"
          local CLUSTER="${8}"

          ####################
          #### KUSTOMIZAR ####
          ####################
          cp kustomize "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}"
          cd "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}"
          ./kustomize edit set image "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"

          cd "${BASETOP}"
          ./kustomize build "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}" >> "${DIRECTORIO}/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
          echo "---" >> "${DIRECTORIO}/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
        }
        export -f parseWorkspaceEjecutar

        echo "${SERVICIOS}" | while read SERVICIO; do
          echo "${WORKSPACE} (${SERVICIO}): Versión ${VERSION}"

          ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${DIRECTORIO} ${PROYECTO} ${WORKSPACE} ${SERVICIO} ${VERSION} ${BASETOP} ${KUSTOMIZER} {}"
        done
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace cronjobs ${PROYECTO} ${ENTORNO} {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace services ${PROYECTO} ${ENTORNO} {}"
fi
