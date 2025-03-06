#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

BASETOP=$(pwd)

export BASETOP

if [[ -f "DESPLEGAR.txt" ]]; then
  updateImagen() {
    KUSTOMIZER="${1}"
    DIR="${2}"
    WORKSPACE="${3}"
    VERSION="${4}"

    cd "kustomizar/${DIR}"
    kustomize edit set image "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
    cd "${BASETOP}"
  }
  export -f updateImagen

  parseWorkspaceEjecutar() {
    DIR="${1}"
    WORKSPACE="${2}"
    SERVICIO="${3}"
    VERSION="${4}"
    KUSTOMIZER="${5}"
    CLUSTER="${6}"

    ####################
    #### KUSTOMIZAR ####
    ####################
    if [[ -d "kustomizar/${DIR}" ]]; then
      updateImagen "${KUSTOMIZER}" "${DIR}" "${WORKSPACE}" "${VERSION}"
      kustomize build "kustomizar/${DIR}" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml"
      echo "---" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml"
    fi
  }
  export -f parseWorkspaceEjecutar

  parseWorkspaceCluster() {
    DIRECTORIO="${1}"
    WORKSPACE="${2}"
    SERVICIO="${3}"
    VERSION="${4}"
    KUSTOMIZER="${5}"
    CLUSTER="${6}"

    parseWorkspaceEjecutar "${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}" "${WORKSPACE}" "${SERVICIO}" "${VERSION}" "${KUSTOMIZER}" "${CLUSTER}"
  }
  export -f parseWorkspaceCluster

  parseWorkspace() {
    RUTA="${1}"
    DIRECTORIO=$(path1 "${RUTA}")
    WORKSPACE=$(path2 "${RUTA}")

    echo "Kustomizando ${WORKSPACE}"
    confige ".[].resourceLabels.zona" | xargs -I '{}' -P 1 bash -c "echo \"# ${WORKSPACE}\" > despliegue_${WORKSPACE}_{}.yaml"

    SERVICIOS=$(config "${RUTA}/package.json" '.servicio | if type == "array" then .[] else . end')
    VERSION=$(cat "${RUTA}/version.txt" || echo "0000.00.00")
    KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

    echo "${SERVICIOS}" | while read SERVICIO; do
      echo "${WORKSPACE} (${SERVICIO}): Versión ${VERSION}"

      confige ".[].resourceLabels.zona" | xargs -I '{}' -P 1 bash -c "parseWorkspaceCluster ${DIRECTORIO} ${WORKSPACE} ${SERVICIO} ${VERSION} ${KUSTOMIZER} {}"
    done
  }
  export -f parseWorkspace

  lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  wait
else
    echo "Omitiendo kustomización"
fi
