#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  BASETOP=$(pwd);

  parseWorkspace() {
    BASETOP="${1}"
    INDICE="${2}"
    NOMBRE="${3}"
    CLUSTER="${4}"
    PRIMERO="${5}"
    RUTA="${6}"
    WORKSPACE=$(path2 "${RUTA}")

    if [[ $(configw "${RUTA}" '.deploy.alone') == "true" && ${PRIMERO} != "true" ]]; then
      return
    fi

    echo "${CLUSTER} ${WORKSPACE}: Preparando"
    if [[ -f "despliegue_${WORKSPACE}_${NOMBRE}.yaml" ]]; then
      cat "despliegue_${WORKSPACE}_${NOMBRE}.yaml" >> "${BASETOP}/despliegue_${INDICE}.yaml"
      echo "---" >> "${BASETOP}/despliegue_${INDICE}.yaml"
    fi
  }

  export -f parseWorkspace

  parseCluster() {
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

    if [[ -f "${BASETOP}/despliegue_${INDICE}.yaml" ]]; then
      rm "${BASETOP}/despliegue_${INDICE}.yaml"
    fi

    lw cronjobs | xargs -I '{}' -P 1 bash -c "parseWorkspace ${BASETOP} ${INDICE} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}" &
    lw services | xargs -I '{}' -P 1 bash -c "parseWorkspace ${BASETOP} ${INDICE} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}" &
    wait

    if [[ -f "${BASETOP}/despliegue_${INDICE}.yaml" ]]; then
      echo "${CLUSTER}: Desplegando"
      gke-deploy run --filename="${BASETOP}/despliegue_${INDICE}.yaml" --cluster="${CLUSTER}" --location="${REGION}" --output="${BASETOP}/output/suggested/${INDICE}"
    fi
  }

  export -f parseCluster

  parseLambda() {
    BASETOP="${1}"
    RUTA="${2}"

    echo "${BASETOP} - ${RUTA}: Preparando Lambda"
  }
   export -f parseLambda

  if [[ -f "${BASETOP}/lambda.sh" ]]; then
    echo "Creando lambda"
    cat "${BASETOP}/lambda.sh"
  fi
  confige ". | keys | .[]" | xargs -I '{}' -P 1 bash -c "parseCluster ${BASETOP} {}"

else
    echo "Omitiendo despliegue"
fi
