#!/bin/bash
######################################
##### SUBIR CACHE DE DEPENDENCIAS ####
######################################
set -e

source @mr/cli/deployment/std/aliases.sh

# El bucket sale de `bucketCache()` (aliases.sh), igual que en cache_get.sh.

if opcion generar; then
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


  echo "Subiendo caché de dependencias"
  if [[ -f .yarn/cache/.md5 ]]; then
    if [[ -f yarn.md5 ]]; then
      if diff .yarn/cache/.md5 yarn.md5; then
        echo "No hay cambios en la caché de dependencias"
      else
        BUCKET=$(bucketCache)
        if [[ -n "${BUCKET}" ]]; then
          parseBucket "${BUCKET}"
        else
          echo "No hay bucket de caché (ni _K8S_CACHE ni etiqueta k8s-cache)"
        fi
      fi
    fi
  fi
  echo "Subiendo caché de dependencias => OK"
else
    echo "Omitiendo subida de caché de dependencias"
fi
