#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  BASETOP=$(pwd);

  parseWorkspaceEjecutar() {
    BASETOP="${1}"
    NOMBRE="${2}"
    CLUSTER="${3}"
    PRIMERO="${4}"
    RUTA="${5}"
    WORKSPACE=$(path2 "${RUTA}")

    if [[ $(configw "${RUTA}" '.deploy.alone') == "true" && ${PRIMERO} != "true" ]]; then
      return
    fi

    echo "${CLUSTER} ${WORKSPACE}: Preparando"
    if [[ -f "${RUTA}/despliegue_${NOMBRE}.yaml" ]]; then
      cat "${RUTA}/despliegue_${NOMBRE}.yaml" >> "${BASETOP}/despliegue_${NOMBRE}.yaml"
      echo "---" >> "${BASETOP}/despliegue_${NOMBRE}.yaml"
    fi
  }

  export -f parseWorkspaceEjecutar

  parseWorkspace() {
    BASETOP="${1}"
    INDICE="${2}"

    NOMBRE=$(confige ".[${INDICE}].resourceLabels.zona")
    CLUSTER=$(confige ".[${INDICE}].name")
    REGION=$(confige ".[${INDICE}].zone")
    if [[ "${INDICE}" == "0" ]]; then
      PRIMERO="true"
    else
      PRIMERO="false"
    fi

    if [[ -f "${BASETOP}/despliegue_${NOMBRE}.yaml" ]]; then
      rm "${BASETOP}/despliegue_${NOMBRE}.yaml"
    fi

    lw cronjobs | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${BASETOP} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}" &
    lw services | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${BASETOP} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}" &
    wait

    if [[ -f "${BASETOP}/despliegue_${NOMBRE}.yaml" ]]; then
      echo "${CLUSTER}: Desplegando"
      gke-deploy run --filename="${BASETOP}/despliegue_${NOMBRE}.yaml" --cluster="${CLUSTER}" --location="${REGION}" --output="${BASETOP}/output/suggested/${NOMBRE}"
    fi
  }

  export -f parseWorkspace

  confige ". | keys | .[]" | xargs -I '{}' -P 1 bash -c "parseWorkspace ${BASETOP} {}"

else
    echo "Omitiendo despliegue"
fi
