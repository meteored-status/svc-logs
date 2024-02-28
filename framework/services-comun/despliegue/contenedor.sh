#!/bin/bash
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO="${1}"

mkdir -p .yarn/plugins

parseWorkspace() {
  PROYECTO=${1}
  ENTORNO="${2}"
  WORKSPACE="${3}"

  if [[ $(./jq -r '.config.generar' "services/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "services/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "services/${WORKSPACE}/package.json") != "browser" ]]; then
        VERSION=$(cat "services/${WORKSPACE}/version.txt")

        echo "${WORKSPACE}: Versión ${VERSION}"

        # GENERAMOS EL CONTENEDOR
        if [[ -f services/${WORKSPACE}/nuevo.txt ]]; then
          HASH=$(cat "services/${WORKSPACE}/hash.txt")

          echo "${WORKSPACE}: Generando contenedor"
          if [[ $(./jq -r '.config.framework' "services/${WORKSPACE}/package.json") != "nextjs" ]]; then
            mkdir -p "services/${WORKSPACE}/assets"
          else
            mkdir -p "services/${WORKSPACE}/public"
          fi

          BASE_IMAGE=$(./jq -r '.config.imagen' "services/${WORKSPACE}/package.json")
          if [[ "${BASE_IMAGE}" == "null" ]]; then
            BASE_IMAGE="node:lts-alpine"
          fi
          echo "${WORKSPACE}: ${BASE_IMAGE}"

          if [[ -f services/${WORKSPACE}/Dockerfile ]]; then
            echo "${WORKSPACE}: Custom Dockerfile"
            docker build --no-cache -f "services/${WORKSPACE}/Dockerfile" --build-arg  ws="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROYECTO}/services-${WORKSPACE}" .
          else
            if [[ $(./jq -r '.config.framework' "services/${WORKSPACE}/package.json") != "nextjs" ]]; then
              echo "${WORKSPACE}: Generic Meteored Dockerfile"
              docker build --no-cache -f "framework/services-comun/despliegue/Dockerfile" --build-arg  ws="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROYECTO}/services-${WORKSPACE}" .
            else
              echo "${WORKSPACE}: Generic Next Dockerfile"
              docker build --no-cache -f "framework/services-comun/despliegue/Dockerfile-next" --build-arg  ws="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROYECTO}/services-${WORKSPACE}" .
            fi
          fi

          echo "${WORKSPACE}: Añadiendo etiquetas"
          docker tag "${PROYECTO}/services-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}"
          docker tag "${PROYECTO}/services-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${VERSION}"
          docker tag "${PROYECTO}/services-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${HASH}"
          docker tag "${PROYECTO}/services-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${ENTORNO}"

          echo "${WORKSPACE}: Subiendo contenedor"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:latest"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${VERSION}"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${HASH}"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/services/${WORKSPACE}:${ENTORNO}"

        else
          echo "${WORKSPACE}: Sin cambios en el contenedor"
        fi
      fi
    fi
  fi
}
export -f parseWorkspace

ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace ${PROYECTO} ${ENTORNO} {}"
