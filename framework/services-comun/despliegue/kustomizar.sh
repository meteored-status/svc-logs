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

  if [[ $(./jq -r '.config.generar' "services/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "services/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "services/${WORKSPACE}/package.json") != "browser" ]]; then
        SERVICIO=$(./jq -r '.servicio' "services/${WORKSPACE}/package.json")
        VERSION=$(cat "services/${WORKSPACE}/version.txt"|| echo "0000.00.00")
        BASETOP=$(pwd)

        echo "${WORKSPACE}: Versión ${VERSION}"

        parseWorkspaceEjecutar() {
          local PROYECTO="${1}"
          local WORKSPACE="${2}"
          local SERVICIO="${3}"
          local VERSION="${4}"
          local BASETOP="${5}"
          local CLUSTER="${6}"

          ####################
          #### KUSTOMIZAR ####
          ####################
          cp kustomize "kustomizar/services/${SERVICIO}/entornos/${CLUSTER}"
          cd "kustomizar/services/${SERVICIO}/entornos/${CLUSTER}"
          ./kustomize edit set image "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${VERSION}"

          cd "${BASETOP}"
          ./kustomize build "kustomizar/services/${SERVICIO}/entornos/${CLUSTER}" > "services/${WORKSPACE}/despliegue_${CLUSTER}.yaml"
        }
        export -f parseWorkspaceEjecutar

        ./jq -r ".[].resourceLabels.zona" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${PROYECTO} ${WORKSPACE} ${SERVICIO} ${VERSION} ${BASETOP} {}"
      fi
    fi
  fi
}
export -f parseWorkspace

ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace ${PROYECTO} ${ENTORNO} {}"
