#!/bin/bash
######################################
##### SUBIR CACHE DE DEPENDENCIAS ####
######################################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "GENERAR.txt" ]]; then
  parseBucket() {
    BUCKET="${1}"

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
        configl ".labels[\"k8s-cache\"]" | xargs -I '{}' -P 10 bash -c "parseBucket {}"
      fi
    fi
  fi
  echo "Subiendo caché de dependencias => OK"
else
    echo "Omitiendo subida de caché de dependencias"
fi
