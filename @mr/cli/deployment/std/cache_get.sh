#!/bin/bash
##########################################
##### DESCARGAR CACHE DE DEPENDENCIAS ####
##########################################
set -e

parseBucket() {
  BUCKET="${1}"

  gsutil -m -q cp -r "gs://${BUCKET}/cache/${TRIGGER_NAME}/cache" .yarn || echo "No hay caché"
}

export -f parseBucket

echo "Descargando caché de dependencias"
./jq -r ".labels[\"k8s-cache\"]" "labels.json" | xargs -I '{}' -P 10 bash -c "parseBucket {}"
if [[ -f .yarn/cache/.md5 ]]; then
  cp .yarn/cache/.md5 yarn.md5
else
  [[ -d .yarn/cache/.md5 ]] || mkdir -p .yarn/cache
  echo "00000000000000000000000000000000" > .yarn/cache/.md5
  echo "ffffffffffffffffffffffffffffffff" > yarn.md5
fi
echo "Descargando caché de dependencias => OK"
