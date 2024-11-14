#!/bin/bash
set -e

BASETOP=$(pwd);
ENTORNO="${1}"

parseWorkspace() {
  ENTORNO="${1}"
  BASETOP="${2}"
  INDICE="${3}"

  NOMBRE=$(./jq -r ".[${INDICE}].resourceLabels.zona" "entornos.json")
  CLUSTER=$(./jq -r ".[${INDICE}].name" "entornos.json")
  REGION=$(./jq -r ".[${INDICE}].zone" "entornos.json")
  if [[ "${INDICE}" == "0" ]]; then
    PRIMERO="true"
  else
    PRIMERO="false"
  fi

  parseWorkspaceEjecutar() {
    BASETOP="${1}"
    NOMBRE="${2}"
    CLUSTER="${3}"
    PRIMERO="${4}"
    WORKSPACE="${5}"

    if [[ $(./jq -r '.config.generar' "services/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.deploy' "services/${WORKSPACE}/package.json") == "true" ]]; then

        if [[ $(./jq -r '.config.runtime' "services/${WORKSPACE}/package.json") == "browser" ]]; then
          return
        fi

        if [[ $(./jq -r '.config.unico' "services/${WORKSPACE}/package.json") == "true" ]]; then
          if [[ ! ${PRIMERO} == "true" ]]; then
            return
          fi
        fi

        echo "${CLUSTER} ${WORKSPACE}: Preparando"
        if [[ -f "services/${WORKSPACE}/despliegue_${NOMBRE}.yaml" ]]; then
          cat "services/${WORKSPACE}/despliegue_${NOMBRE}.yaml" >> "${BASETOP}/despliegue_${NOMBRE}.yaml"
          echo "---" >> "${BASETOP}/despliegue_${NOMBRE}.yaml"
        fi
      fi
    fi
  }

  export -f parseWorkspaceEjecutar

  ls "${BASETOP}/services" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar ${BASETOP} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}"

  if [[ -f "${BASETOP}/despliegue_${NOMBRE}.yaml" ]]; then
    echo "${CLUSTER}: Desplegando"
    gke-deploy run --filename="${BASETOP}/despliegue_${NOMBRE}.yaml" --cluster="${CLUSTER}" --location="${REGION}" --output="${BASETOP}/output/suggested/${NOMBRE}"
  fi
}

export -f parseWorkspace

./jq -r ". | keys | .[]" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspace ${ENTORNO} ${BASETOP} {}"
