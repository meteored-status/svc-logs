#!/bin/bash
##############################
##### CLONAR REPOSITORIOS ####
##############################
set -euo pipefail

ENTORNO="${1}"

parseRepository() {
  local ENTORNO="${1}"
  local COMPANY="${2}"

  echo "Clonando repositorio ${COMPANY}/kustomize.git"
  git clone "https://${GITTOKEN}@github.com/${COMPANY}/kustomize.git" kustomizar
  if [[ ${ENTORNO} != "produccion" ]]; then
    echo "Cambiando a la rama \"DEVELOP\""
    cd kustomizar
    git fetch origin
    git checkout develop
    cd ..
  fi
}
export -f parseRepository

./jq -r ".labels[\"k8s-github\"]" "labels.json" | xargs -I '{}' -P10 -n1 bash -c "parseRepository ${ENTORNO} {}"

git show -s --format=%ci HEAD > "last_commit.txt"
