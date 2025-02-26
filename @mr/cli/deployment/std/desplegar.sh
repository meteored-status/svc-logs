#!/bin/bash
set -e

BASETOP=$(pwd);

parseWorkspace() {
  BASETOP="${1}"
  INDICE="${2}"

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

    if [[ $(./jq -r '.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
      if [[ $(./jq -r '.deploy.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then

        if [[ $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "browser" && $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "cfworker" ]]; then
          return
        fi

        if [[ $(./jq -r '.deploy.alone' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
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

  if [[ -f "${BASETOP}/despliegue_${NOMBRE}.yaml" ]]; then
    rm "${BASETOP}/despliegue_${NOMBRE}.yaml"
  fi

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

./jq -r ". | keys | .[]" "entornos.json" | xargs -I '{}' -P 1 bash -c "parseWorkspace ${BASETOP} {}"
