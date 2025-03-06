#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  parseWorkspaceEjecutar() {
    DIRECTORIO="${1}"
    WORKSPACE="${2}"
    SERVICIO="${3}"
    VERSION="${4}"
    BASETOP="${5}"
    KUSTOMIZER="${6}"
    CLUSTER="${7}"
    RUTA="${DIRECTORIO}/${WORKSPACE}"

    ####################
    #### KUSTOMIZAR ####
    ####################
    cp kustomize "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}"
    cd "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}"
    ./kustomize edit set image "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"

    cd "${BASETOP}"
    ./kustomize build "kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos/${CLUSTER}" >> "${RUTA}/despliegue_${CLUSTER}.yaml"
    echo "---" >> "${RUTA}/despliegue_${CLUSTER}.yaml"
  }
  export -f parseWorkspaceEjecutar

  parseWorkspace() {
    RUTA="${1}"
    DIRECTORIO=$(path1 "${RUTA}")
    WORKSPACE=$(path2 "${RUTA}")

    echo "Kustomizando ${WORKSPACE}"
    confige ".[].resourceLabels.zona" | xargs -I '{}' -P 1 bash -c "echo \"# ${WORKSPACE}\" > ${RUTA}/despliegue_{}.yaml"

    SERVICIOS=$(config "${RUTA}/package.json" '.servicio | if type == "array" then .[] else . end')
    VERSION=$(cat "${RUTA}/version.txt" || echo "0000.00.00")
    BASETOP=$(pwd)
    KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

    echo "${SERVICIOS}" | while read SERVICIO; do
      echo "${WORKSPACE} (${SERVICIO}): Versión ${VERSION}"

      confige ".[].resourceLabels.zona" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${DIRECTORIO} ${WORKSPACE} ${SERVICIO} ${VERSION} ${BASETOP} ${KUSTOMIZER} {}"
    done
  }
  export -f parseWorkspace

  lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  wait
else
    echo "Omitiendo kustomización"
fi
