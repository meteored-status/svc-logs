#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO="${1}"

parseWorkspace() {
  local PROYECTO="${1}"
  local ENTORNO="${2}"
  local WORKSPACE="${3}"

  echo "Kustomizando ${WORKSPACE}"
  ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "echo \"# ${WORKSPACE}\" > services/${WORKSPACE}/despliegue_{}.yaml"

  if [[ $(./jq -r '.config.generar' "services/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "services/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "services/${WORKSPACE}/package.json") != "browser" ]]; then
        SERVICIOS=$(./jq -r '.servicio | if type == "array" then .[] else . end' "services/${WORKSPACE}/package.json")
        VERSION=$(cat "services/${WORKSPACE}/version.txt" || echo "0000.00.00")
        BASETOP=$(pwd)
        KUSTOMIZER=$(./jq -r '.config.kustomize' "services/${WORKSPACE}/package.json")


        parseWorkspaceEjecutar() {
          local PROYECTO="${1}"
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
          ./kustomize edit set image "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"

          cd "${BASETOP}"
          ./kustomize build "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}" >> "services/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
          echo "---" >> "services/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
        }
        export -f parseWorkspaceEjecutar

        echo "${SERVICIOS}" | while read SERVICIO; do
          echo "${WORKSPACE} (${SERVICIO}): Versión ${VERSION}"

          ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${PROYECTO} ${WORKSPACE} ${SERVICIO} ${VERSION} ${BASETOP} ${KUSTOMIZER} {}"
        done
      fi
    fi
  fi
}
export -f parseWorkspace

ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace ${PROYECTO} ${ENTORNO} {}"
