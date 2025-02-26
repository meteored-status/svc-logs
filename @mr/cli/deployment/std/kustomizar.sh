#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

parseWorkspace() {
  local DIRECTORIO="${1}"
  local WORKSPACE="${2}"

  echo "Kustomizando ${WORKSPACE}"
  ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "echo \"# ${WORKSPACE}\" > ${DIRECTORIO}/${WORKSPACE}/despliegue_{}.yaml"

  if [[ $(./jq -r '.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
    if [[ $(./jq -r '.deploy.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
      if [[ $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "browser" && $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "cfworker" ]]; then
        SERVICIOS=$(./jq -r '.servicio | if type == "array" then .[] else . end' "${DIRECTORIO}/${WORKSPACE}/package.json")
        VERSION=$(cat "${DIRECTORIO}/${WORKSPACE}/version.txt" || echo "0000.00.00")
        BASETOP=$(pwd)
        KUSTOMIZER=$(./jq -r '.deploy.kustomize' "${DIRECTORIO}/${WORKSPACE}/mrpack.json")


        parseWorkspaceEjecutar() {
          local DIRECTORIO="${1}"
          local WORKSPACE="${2}"
          local SERVICIO="${3}"
          local VERSION="${4}"
          local BASETOP="${5}"
          local KUSTOMIZER="${6}"
          local CLUSTER="${7}"

          ####################
          #### KUSTOMIZAR ####
          ####################
          cp kustomize "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}"
          cd "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}"
          ./kustomize edit set image "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"

          cd "${BASETOP}"
          ./kustomize build "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}" >> "${DIRECTORIO}/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
          echo "---" >> "${DIRECTORIO}/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
        }
        export -f parseWorkspaceEjecutar

        echo "${SERVICIOS}" | while read SERVICIO; do
          echo "${WORKSPACE} (${SERVICIO}): Versión ${VERSION}"

          ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${DIRECTORIO} ${WORKSPACE} ${SERVICIO} ${VERSION} ${BASETOP} ${KUSTOMIZER} {}"
        done
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace cronjobs {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace services {}"
fi
