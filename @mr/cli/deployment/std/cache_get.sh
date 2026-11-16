#!/bin/bash
##########################################
##### DESCARGAR CACHE DE DEPENDENCIAS ####
##########################################
set -e

source @mr/cli/deployment/std/aliases.sh

# El bucket sale de `bucketCache()` (aliases.sh), que no necesita `labels.json`: este paso espera solo
# a la guarda y corre en paralelo con «Descargas» y «Labels».

parseBucket() {
  BUCKET="${1}"

  gcloud storage --no-user-output-enabled cp -r "gs://${BUCKET}/cache/${TRIGGER_NAME}/cache" .yarn || echo "No hay caché"
}


echo "Descargando caché de dependencias"
BUCKET=$(bucketCache)
if [[ -n "${BUCKET}" ]]; then
  parseBucket "${BUCKET}"
else
  echo "No hay bucket de caché (ni _K8S_CACHE ni etiqueta k8s-cache)"
fi
if [[ -f .yarn/cache/.md5 ]]; then
  cp .yarn/cache/.md5 yarn.md5
else
  [[ -d .yarn/cache/.md5 ]] || mkdir -p .yarn/cache
  echo "00000000000000000000000000000000" > .yarn/cache/.md5
  echo "ffffffffffffffffffffffffffffffff" > yarn.md5
fi
echo "Descargando caché de dependencias => OK"
