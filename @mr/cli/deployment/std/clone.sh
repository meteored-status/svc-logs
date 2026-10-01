#!/bin/bash
##############################
##### CLONAR REPOSITORIOS ####
##############################
set -euo pipefail

source @mr/cli/deployment/std/aliases.sh

# La organización de GitHub sale de `_K8S_GITHUB` si el trigger la define; si no, de la etiqueta
# `k8s-github` de `labels.json`, como siempre.
companies() {
  if [[ -n "${_K8S_GITHUB:-}" ]]; then
    echo "${_K8S_GITHUB}"
  else
    configl ".labels[\"k8s-github\"]"
  fi
}

if [[ -f "DESPLEGAR.txt" ]]; then
  parseRepository() {
    local COMPANY="${1}"

    echo "Clonando repositorio ${COMPANY}/kustomize.git"
    git clone "https://${GITTOKEN}@github.com/${COMPANY}/kustomize.git" kustomizar
    if [[ ${_ENTORNO} != "produccion" ]]; then
      echo "Cambiando a la rama \"DEVELOP\""
      cd kustomizar
      git fetch origin
      git checkout develop
      cd ..
    fi
  }
  export -f parseRepository

  companies | xargs -I '{}' -P10 -n1 bash -c "parseRepository {}"
else
    echo "Omitiendo clonado de kustomizer"
fi
