#!/bin/bash
######################################
##### SUBIR CACHE DE DEPENDENCIAS ####
######################################
set -e

TRIGGER_NAME="${1}"

parseBucket() {
  TRIGGER_NAME="${1}"
  BUCKET="${2}"

  [ -d ".yarn/cache" ] && gsutil -m -q rm -r "gs://${BUCKET}/cache/${TRIGGER_NAME}/cache/" || echo "No hay caché"
  [ -d ".yarn/cache" ] && gsutil -m -q cp -r .yarn/cache "gs://${BUCKET}/cache/${TRIGGER_NAME}/"
}

export -f parseBucket

echo "Subiendo caché de dependencias"
if [[ -f .yarn/cache/.md5 ]]; then
  if [[ -f yarn.md5 ]]; then
    if diff .yarn/cache/.md5 yarn.md5; then
      echo "No hay cambios en la caché de dependencias"
    else
      ./jq -r ".labels[\"k8s-cache\"]" "labels.json" | xargs -I '{}' -P 10 bash -c "parseBucket ${TRIGGER_NAME} {}"
    fi
  fi
fi
echo "Subiendo caché de dependencias => OK"
