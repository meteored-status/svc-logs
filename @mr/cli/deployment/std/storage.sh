#!/bin/bash
set -e

parseWorkspace() {
  local DIRECTORIO="${1}"
  local WORKSPACE="${2}"

  if [[ $(./jq -r '.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
    if [[ $(./jq -r '.deploy.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
      if [[ $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "browser" ]]; then
        echo "Storage: ${WORKSPACE} => NO"
        return
      fi

      echo "Storage: ${WORKSPACE} => SI"

      parseBucket() {
        local DIRECTORIO=${1}
        local WORKSPACE=${2}
        local BUCKET=${3}
        local SUBDIR=${4}

        PACKAGE=$(./jq -r ".deploy.storage.subdir" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
        if [[ -z "${PACKAGE}" || "${PACKAGE}" == "null" ]]; then
          PACKAGE="${WORKSPACE}"
        fi

        BUNDLE=$(./jq -r ".deploy.storage.bundle" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
        PREFIX=$(./jq -r ".deploy.storage.subdirPrefix" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
        POSTFIX=$(./jq -r ".deploy.storage.subdirPostfix" "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
        SUBDIR="${PREFIX}${PACKAGE}${POSTFIX}"

#        SUBDIR=$(./jq -r ".config.storage.subdir" "${DIRECTORIO}/${WORKSPACE}/package.json")
#        if [[ -z "${SUBDIR}" || "${SUBDIR}" == "null" ]]; then
#          SUBDIR=""
#        else
#          SUBDIR="/${SUBDIR}"
#        fi
#
#        SUBDIR2=$(./jq -r ".config.storage.subdir2" "${DIRECTORIO}/${WORKSPACE}/package.json")
#        if [ "${SUBDIR2}" = "null" ]; then
#          BUNDLE=""
#          SUBDIR2="output/"
#        elif [ -z "${SUBDIR2}" ]; then
#          BUNDLE="bundle/"
#          SUBDIR2=""
#        else
#          BUNDLE="bundle/"
#          SUBDIR2="${SUBDIR2}/"
#        fi

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

      if ./jq -e '.deploy.storage.buckets' "${DIRECTORIO}/${WORKSPACE}/mrpack.json" > /dev/null; then
        ./jq -r ".deploy.storage.buckets | .[]" "${DIRECTORIO}/${WORKSPACE}/mrpack.json" | xargs -I '{}' -P 10 bash -c "parseBucket ${DIRECTORIO} ${WORKSPACE} {}"
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace cronjobs {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace services {}"
fi

