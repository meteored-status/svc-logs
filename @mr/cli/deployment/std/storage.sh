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
    VERSION_ANTIGUA=$(gsutil cat "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}/version.txt")

    if [ "${HASH_NUEVO}" = "${HASH_ANTIGUO}" ]; then
      echo "${WORKSPACE}: Sin cambios"
    else
      echo "${WORKSPACE}: Subiendo cambios"

      FECHA=$(date "+%Y.%m.%d")
      if [[ -n "${VERSION_ANTIGUA}" && "${VERSION_ANTIGUA}" == "${FECHA}"* ]]; then
        BUILD=$(echo "${VERSION_ANTIGUA}" | sed -n -E "s/[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}-([1-9][0-9]*)/\1/p")
        if [[ "${BUILD}" =~ ^[0-9]+$ ]]; then
          echo "${FECHA}-$((10#$BUILD+1))" > "${DIRECTORIO}/${WORKSPACE}/version.txt"
        else
          echo "${FECHA}-1" > "${DIRECTORIO}/${WORKSPACE}/version.txt"
        fi
      else
        echo "${FECHA}-1" > "${DIRECTORIO}/${WORKSPACE}/version.txt"
      fi
      echo "Version (${DIRECTORIO}/${WORKSPACE}): $(cat "${DIRECTORIO}/${WORKSPACE}/version.txt")"

      gsutil -m cp -R "${DIRECTORIO}/${WORKSPACE}/output/${BUNDLE}*" "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}" || exit 1
      gsutil -m cp "${DIRECTORIO}/${WORKSPACE}/hash.txt" "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}/" || exit 1
      gsutil -m cp "${DIRECTORIO}/${WORKSPACE}/version.txt" "gs://${BUCKET}/${_ENTORNO}/${SUBDIR}/" || exit 1
    fi;
  }
  export -f parseBucket

  parseWorkspace() {
    RUTA="${1}"
    WORKSPACE=$(path2 "${RUTA}")

    echo "Storage: ${WORKSPACE} => SI"

    if configw "${RUTA}" ".deploy.storage.buckets.${_ENTORNO}" > /dev/null; then
      configw "${RUTA}" ".deploy.storage.buckets.${_ENTORNO} | .[]" | xargs -I '{}' -P 10 bash -c "parseBucket ${RUTA} {}"
    fi
  }
  export -f parseWorkspace

  lb cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  lb services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  wait
else
    echo "Omitiendo la subida de código a Storage"
fi

