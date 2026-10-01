#!/bin/bash
######################################
##### SUBIR CACHE DE DEPENDENCIAS ####
######################################
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

if [[ -f "GENERAR.txt" ]]; then
  # Ningún fallo de aquí puede tumbar el despliegue. La caché es una optimización, y para cuando
  # corre este paso la imagen ya está construida y subida: hacer fallar el build por no poder
  # escribir en el bucket convierte un despliegue bueno en uno roto. Mismo criterio que el
  # `ignore-error=true` de la caché de capas en `contenedor.sh`.
  #
  # Sin las guardas había dos formas de morir, las dos con `set -e`: que fallara el `cp` (un error
  # transitorio de GCS bastaba), y que `.yarn/cache` no existiera, porque entonces el propio
  # `[ -d ]` de la segunda línea devolvía 1. Los fallos se siguen viendo en el log, que es lo que
  # hace falta; lo que no hacen es parar nada.
  parseBucket() {
    BUCKET="${1}"

    [ -d ".yarn/cache" ] || return 0

    gcloud storage --no-user-output-enabled rm -r "gs://${BUCKET}/cache/${TRIGGER_NAME}/cache/" || echo "No hay caché previa que borrar"
    gcloud storage --no-user-output-enabled cp -r .yarn/cache "gs://${BUCKET}/cache/${TRIGGER_NAME}/" || echo "No se pudo subir la caché de dependencias"
  }

  export -f parseBucket

  echo "Subiendo caché de dependencias"
  if [[ -f .yarn/cache/.md5 ]]; then
    if [[ -f yarn.md5 ]]; then
      if diff .yarn/cache/.md5 yarn.md5; then
        echo "No hay cambios en la caché de dependencias"
      else
        buckets | xargs -I '{}' -P 10 bash -c "parseBucket {}"
      fi
    fi
  fi
  echo "Subiendo caché de dependencias => OK"
else
    echo "Omitiendo subida de caché de dependencias"
fi
