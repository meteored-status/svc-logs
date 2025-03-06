#!/bin/bash
##############################
##### CLONAR REPOSITORIOS ####
##############################
set -euo pipefail

source @mr/cli/deployment/std/aliases.sh

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

  configl ".labels[\"k8s-github\"]" | xargs -I '{}' -P10 -n1 bash -c "parseRepository {}"
else
    echo "Omitiendo clonado de kustomizer"
fi
