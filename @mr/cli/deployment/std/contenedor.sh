#!/bin/bash
set -e

mkdir -p .yarn/plugins

parseWorkspace() {
  DIRECTORIO="${1}"
  WORKSPACE="${2}"

  if [[ $(./jq -r '.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
    if [[ $(./jq -r '.deploy.enabled' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") == "true" ]]; then
      if [[ $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "browser" && $(./jq -r '.deploy.runtime' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "cfworker" ]]; then
        VERSION=$(cat "${DIRECTORIO}/${WORKSPACE}/version.txt")
        KUSTOMIZER=$(./jq -r '.deploy.kustomize' "${DIRECTORIO}/${WORKSPACE}/mrpack.json")

        echo "${WORKSPACE}: Versión ${VERSION}"

        # GENERAMOS EL CONTENEDOR
        if [[ -f ${DIRECTORIO}/${WORKSPACE}/nuevo.txt ]]; then
          HASH=$(cat "${DIRECTORIO}/${WORKSPACE}/hash.txt")

          echo "${WORKSPACE}: Generando contenedor"
          if [[ $(./jq -r '.build.framework' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "nextjs" ]]; then
            mkdir -p "${DIRECTORIO}/${WORKSPACE}/assets"
          else
            mkdir -p "${DIRECTORIO}/${WORKSPACE}/public"
          fi

          BASE_IMAGE=$(./jq -r '.deploy.imagen' "${DIRECTORIO}/${WORKSPACE}/mrpack.json")
          if [[ "${BASE_IMAGE}" == "null" ]]; then
            BASE_IMAGE="node:lts-alpine"
          fi
          echo "${WORKSPACE}: ${BASE_IMAGE}"

          if [[ -f ${DIRECTORIO}/${WORKSPACE}/Dockerfile ]]; then
            echo "${WORKSPACE}: Custom Dockerfile"
            docker build --no-cache -f "${DIRECTORIO}/${WORKSPACE}/Dockerfile" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
          else
            if [[ $(./jq -r '.build.framework' "${DIRECTORIO}/${WORKSPACE}/mrpack.json") != "nextjs" ]]; then
              echo "${WORKSPACE}: Generic Meteored Dockerfile"
              docker build --no-cache -f "@mr/cli/deployment/std/Dockerfile" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
            else
              echo "${WORKSPACE}: Generic Next Dockerfile"
              docker build --no-cache -f "@mr/cli/deployment/std/Dockerfile-next" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
            fi
          fi

          echo "${WORKSPACE}: Añadiendo etiquetas"
          docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}"
          docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
          docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${HASH}"
          docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${_ENTORNO}"
          docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:deployed_${_ENTORNO}"

          echo "${WORKSPACE}: Subiendo contenedor"
          docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:latest"
          docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
          docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${HASH}"
          docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${_ENTORNO}"
          docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:deployed_${_ENTORNO}"

        else
          echo "${WORKSPACE}: Sin cambios en el contenedor"
        fi
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
