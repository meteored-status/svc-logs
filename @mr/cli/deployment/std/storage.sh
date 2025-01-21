#!/bin/bash
set -e

#BASE=$(dirname "$0");
#BASETOP=$(pwd);
ENTORNO=${1}

parseWorkspace() {
  local DIRECTORIO="${1}"
  local ENTORNO="${2}"
  local WORKSPACE="${3}"

  if [[ $(./jq -r '.config.generar' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "${DIRECTORIO}/${WORKSPACE}/package.json") != "browser" ]]; then
        echo "Storage: ${WORKSPACE} => NO"
        return
      fi

      echo "Storage: ${WORKSPACE} => SI"

      parseBucket() {
        local ENTORNO=${1}
        local WORKSPACE=${2}
        local BUCKET=${3}
        local SUBDIR=${4}

        PACKAGE=$(./jq -r ".config.storage.package" "${DIRECTORIO}/${WORKSPACE}/package.json")
        if [[ -z "${PACKAGE}" || "${PACKAGE}" == "null" ]]; then
          PACKAGE="${WORKSPACE}"
        fi

        SUBDIR=$(./jq -r ".config.storage.subdir" "${DIRECTORIO}/${WORKSPACE}/package.json")
        if [[ -z "${SUBDIR}" || "${SUBDIR}" == "null" ]]; then
          SUBDIR=""
        else
          SUBDIR="/${SUBDIR}"
        fi

        SUBDIR2=$(./jq -r ".config.storage.subdir2" "${DIRECTORIO}/${WORKSPACE}/package.json")
        if [ "${SUBDIR2}" = "null" ]; then
          BUNDLE=""
          SUBDIR2="output/"
        elif [ -z "${SUBDIR2}" ]; then
          BUNDLE="bundle/"
          SUBDIR2=""
        else
          BUNDLE="bundle/"
          SUBDIR2="${SUBDIR2}/"
        fi

        HASH_NUEVO=$(cat "${DIRECTORIO}/${WORKSPACE}/output/hash.txt")
        HASH_ANTIGUO=$(gsutil cat "gs://${BUCKET}/${ENTORNO}${SUBDIR}/${PACKAGE}/${SUBDIR2}hash.txt")

        if [ "${HASH_NUEVO}" = "${HASH_ANTIGUO}" ]; then
          echo "${WORKSPACE}: Sin cambios"
        else
          echo "${WORKSPACE}: Subiendo cambios"
          gsutil -m cp -R "${DIRECTORIO}/${WORKSPACE}/output/${BUNDLE}*" "gs://${BUCKET}/${ENTORNO}${SUBDIR}/${PACKAGE}/${SUBDIR2}"
          gsutil -m cp -R "${DIRECTORIO}/${WORKSPACE}/hash.txt" "gs://${BUCKET}/${ENTORNO}${SUBDIR}/${PACKAGE}/${SUBDIR2}"
        fi;
      }
      export -f parseBucket

      if ./jq -e '.config.storage.buckets' "${DIRECTORIO}/${WORKSPACE}/package.json" > /dev/null; then
        ./jq -r ".config.storage.buckets | .[]" "${DIRECTORIO}/${WORKSPACE}/package.json" | xargs -I '{}' -P 10 bash -c "parseBucket ${ENTORNO} ${WORKSPACE} {}"
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace cronjobs ${ENTORNO} {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace services ${ENTORNO} {}"
fi

