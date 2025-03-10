#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "GENERAR.txt" ]]; then
  parseBucket() {
    RUTA="${1}"
    DIRECTORIO=$(path1 "${RUTA}")
    WORKSPACE=$(path2 "${RUTA}")
    local BUCKET=${2}

    PACKAGE=$(jq -r ".deploy.storage.subdir" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
    if [[ -z "${PACKAGE}" || "${PACKAGE}" == "null" ]]; then
      PACKAGE="${WORKSPACE}"
    fi

    BUNDLE=$(jq -r ".deploy.storage.bundle" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
    PREFIX=$(jq -r ".deploy.storage.subdirPrefix" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
    POSTFIX=$(jq -r ".deploy.storage.subdirPostfix" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
    SUBDIR="${PREFIX}${PACKAGE}${POSTFIX}"

    HASH_NUEVO=$(cat "${DIRECTORIO}/${WORKSPACE}/output/hash.txt")
    HASH_ANTIGUO=$(gsutil cat "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}/hash.txt")

    if [ "${HASH_NUEVO}" = "${HASH_ANTIGUO}" ]; then
      echo "${WORKSPACE}: Sin cambios"
    else
      echo "${WORKSPACE}: Subiendo cambios"
      gsutil -m cp -R "${DIRECTORIO}/${WORKSPACE}/output/${BUNDLE}*" "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}"
      gsutil -m cp -R "${DIRECTORIO}/${WORKSPACE}/hash.txt" "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}"
    fi;
  }
  export -f parseBucket

  parseWorkspace() {
    RUTA="${1}"
    WORKSPACE=$(path2 "${RUTA}")

    echo "Storage: ${WORKSPACE} => SI"

    if configw "${RUTA}" '.deploy.storage.buckets' > /dev/null; then
      configw "${RUTA}" ".deploy.storage.buckets | .[]" | xargs -I '{}' -P 10 bash -c "parseBucket ${RUTA} {}"
    fi
  }
  export -f parseWorkspace

  lb cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  lb services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  wait
else
    echo "Omitiendo la subida de código a Storage"
fi

