#!/bin/bash
set -e

#BASE=$(dirname "$0");
#BASETOP=$(pwd);
ENTORNO=${1}

parseWorkspace() {
  local ENTORNO=${1}
  local WORKSPACE=${2}

  if [[ $(./jq -r '.config.generar' "services/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "services/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "services/${WORKSPACE}/package.json") != "browser" ]]; then
        echo "Storage: ${WORKSPACE} => NO"
        return
      fi

      echo "Storage: ${WORKSPACE} => SI"

      parseBucket() {
        local ENTORNO=${1}
        local WORKSPACE=${2}
        local BUCKET=${3}

        HASH_NUEVO=$(cat "services/${WORKSPACE}/output/hash.txt")
        HASH_ANTIGUO=$(gsutil cat "gs://${BUCKET}/${ENTORNO}/${WORKSPACE}/output/hash.txt")

        if [ "${HASH_NUEVO}" = "${HASH_ANTIGUO}" ]; then
          echo "${WORKSPACE}: Sin cambios"
        else
          echo "${WORKSPACE}: Subiendo cambios"
          gsutil -m cp -R "services/${WORKSPACE}/output/*" "gs://${BUCKET}/${ENTORNO}/${WORKSPACE}/output/"
        fi;
      }
      export -f parseBucket

      ./jq -r ".config.storage | .[]" "services/${WORKSPACE}/package.json" | xargs -I '{}' -P 1 bash -c "parseBucket ${ENTORNO} ${WORKSPACE} {}"
    fi
  fi
}
export -f parseWorkspace


ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace ${ENTORNO} {}"

