#!/bin/bash
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO="${1}"

mkdir -p .yarn/plugins

parseWorkspace() {
  DIRECTORIO="${1}"
  PROYECTO=${2}
  ENTORNO="${3}"
  WORKSPACE="${4}"

  if [[ $(./jq -r '.config.generar' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
    if [[ $(./jq -r '.config.deploy' "${DIRECTORIO}/${WORKSPACE}/package.json") == "true" ]]; then
      if [[ $(./jq -r '.config.runtime' "${DIRECTORIO}/${WORKSPACE}/package.json") != "browser" ]]; then
        VERSION=$(cat "${DIRECTORIO}/${WORKSPACE}/version.txt")
        KUSTOMIZER=$(./jq -r '.config.kustomize' "${DIRECTORIO}/${WORKSPACE}/package.json")

        echo "${WORKSPACE}: Versión ${VERSION}"

        # GENERAMOS EL CONTENEDOR
        if [[ -f ${DIRECTORIO}/${WORKSPACE}/nuevo.txt ]]; then
          HASH=$(cat "${DIRECTORIO}/${WORKSPACE}/hash.txt")

          echo "${WORKSPACE}: Generando contenedor"
          if [[ $(./jq -r '.config.framework' "${DIRECTORIO}/${WORKSPACE}/package.json") != "nextjs" ]]; then
            mkdir -p "${DIRECTORIO}/${WORKSPACE}/assets"
          else
            mkdir -p "${DIRECTORIO}/${WORKSPACE}/public"
          fi

          BASE_IMAGE=$(./jq -r '.config.imagen' "${DIRECTORIO}/${WORKSPACE}/package.json")
          if [[ "${BASE_IMAGE}" == "null" ]]; then
            BASE_IMAGE="node:lts-alpine"
          fi
          echo "${WORKSPACE}: ${BASE_IMAGE}"

          if [[ -f ${DIRECTORIO}/${WORKSPACE}/Dockerfile ]]; then
            echo "${WORKSPACE}: Custom Dockerfile"
            docker build --no-cache -f "${DIRECTORIO}/${WORKSPACE}/Dockerfile" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" .
          else
            if [[ $(./jq -r '.config.framework' "${DIRECTORIO}/${WORKSPACE}/package.json") != "nextjs" ]]; then
              echo "${WORKSPACE}: Generic Meteored Dockerfile"
              docker build --no-cache -f "@mr/cli/deployment/std/Dockerfile" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" .
            else
              echo "${WORKSPACE}: Generic Next Dockerfile"
              docker build --no-cache -f "@mr/cli/deployment/std/Dockerfile-next" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" .
            fi
          fi

          echo "${WORKSPACE}: Añadiendo etiquetas"
          docker tag "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}"
          docker tag "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
          docker tag "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${HASH}"
          docker tag "${PROYECTO}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${ENTORNO}"

          echo "${WORKSPACE}: Subiendo contenedor"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:latest"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${HASH}"
          docker push "europe-west1-docker.pkg.dev/${PROYECTO}/${KUSTOMIZER}/${WORKSPACE}:${ENTORNO}"

        else
          echo "${WORKSPACE}: Sin cambios en el contenedor"
        fi
      fi
    fi
  fi
}
export -f parseWorkspace

if [ -d "cronjobs" ]; then
  ls cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace cronjobs ${PROYECTO} ${ENTORNO} {}"
fi
if [ -d "services" ]; then
  ls services | xargs -I '{}' -P 10 bash -c "parseWorkspace services ${PROYECTO} ${ENTORNO} {}"
fi
