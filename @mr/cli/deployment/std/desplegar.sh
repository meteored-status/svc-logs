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
    DIRECTORIO="${1}"
    BASETOP="${2}"
    NOMBRE="${3}"
    CLUSTER="${4}"
    PRIMERO="${5}"
    WORKSPACE="${6}"

    if [[ $(./jq -r '.config.generar' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.deploy' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then

        if [[ $(./jq -r '.config.runtime' "${DIRECTORIO}/${WORKSPACE}/package.json") == "browser" ]]; then
          return
        fi

        if [[ $(./jq -r '.config.unico' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
          if [[ ! ${PRIMERO} == "true" ]]; then
            return
          fi
        fi

        echo "${CLUSTER} ${WORKSPACE}: Preparando"
        if [[ -f "${DIRECTORIO}/${WORKSPACE}/despliegue_${NOMBRE}.yaml" ]]; then
          cat "${DIRECTORIO}/${WORKSPACE}/despliegue_${NOMBRE}.yaml" >> "${BASETOP}/despliegue_${NOMBRE}.yaml"
          echo "---" >> "${BASETOP}/despliegue_${NOMBRE}.yaml"
        fi
      fi
    fi
  }

  export -f parseWorkspaceEjecutar

  if [ -d "cronjobs" ]; then
    ls "${BASETOP}/cronjobs" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar cronjobs ${BASETOP} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}"
  fi
  if [ -d "services" ]; then
    ls "${BASETOP}/services" | xargs -I '{}' -P 1 bash -c "parseWorkspaceEjecutar services ${BASETOP} ${NOMBRE} ${CLUSTER} ${PRIMERO} {}"
  fi

  if [[ -f "${BASETOP}/despliegue_${NOMBRE}.yaml" ]]; then
    echo "${CLUSTER}: Desplegando"
    gke-deploy run --filename="${BASETOP}/despliegue_${NOMBRE}.yaml" --cluster="${CLUSTER}" --location="${REGION}" --output="${BASETOP}/output/suggested/${NOMBRE}"
  fi
}

export -f parseWorkspace

./jq -r ". | keys | .[]" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspace ${ENTORNO} ${BASETOP} {}"
