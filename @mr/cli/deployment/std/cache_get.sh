#!/bin/bash
##########################################
##### DESCARGAR CACHE DE DEPENDENCIAS ####
##########################################
set -e

source @mr/cli/deployment/std/aliases.sh

# El bucket de la caché sale de `_K8S_CACHE` si el trigger la define; si no, de la etiqueta
# `k8s-cache` de `labels.json`, como siempre.
buckets() {
  if [[ -n "${_K8S_CACHE}" ]]; then
    echo "${_K8S_CACHE}"
  else
    configl ".labels[\"k8s-cache\"]"
  fi
}

parseBucket() {
  BUCKET="${1}"

  gcloud storage --no-user-output-enabled cp -r "gs://${BUCKET}/cache/${TRIGGER_NAME}/cache" .yarn || echo "No hay caché"
}

export -f parseBucket

echo "Descargando caché de dependencias"
buckets | xargs -I '{}' -P 10 bash -c "parseBucket {}"
if [[ -f .yarn/cache/.md5 ]]; then
  cp .yarn/cache/.md5 yarn.md5
else
  [[ -d .yarn/cache/.md5 ]] || mkdir -p .yarn/cache
  echo "00000000000000000000000000000000" > .yarn/cache/.md5
  echo "ffffffffffffffffffffffffffffffff" > yarn.md5
fi
echo "Descargando caché de dependencias => OK"
