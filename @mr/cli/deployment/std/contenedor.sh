#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "GENERAR.txt" ]]; then
  mkdir -p .yarn/plugins

  parseWorkspace() {
    RUTA="${1}"
    DIRECTORIO=$(path1 "${RUTA}")
    WORKSPACE=$(path2 "${RUTA}")

    VERSION=$(cat "${RUTA}/version.txt")
    KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

    echo "${RUTA}: Versión ${VERSION}"

    # GENERAMOS EL CONTENEDOR
    if [[ -f ${RUTA}/nuevo.txt ]]; then
      HASH=$(cat "${RUTA}/hash.txt")

      echo "${RUTA}: Generando contenedor"
      if [[ $(configw "${RUTA}" .build.framework) != "nextjs" ]]; then
        mkdir -p "${RUTA}/assets"
      else
        mkdir -p "${RUTA}/public"
      fi

      BASE_IMAGE=$(configw "${RUTA}" .deploy.imagen)
      if [[ "${BASE_IMAGE}" == "null" ]]; then
        BASE_IMAGE="node:lts-alpine"
      fi
      echo "${RUTA}: ${BASE_IMAGE}"

      if [[ -f ${RUTA}/Dockerfile ]]; then
        echo "${RUTA}: Custom Dockerfile"
        docker build --no-cache -f "${RUTA}/Dockerfile" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
      else
        if [[ $(configw "${RUTA}" .build.framework) != "nextjs" ]]; then
          echo "${RUTA}: Generic Meteored Dockerfile"
          docker build --no-cache -f "@mr/cli/deployment/std/Dockerfile" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
        else
          echo "${RUTA}: Generic Next Dockerfile"
          docker build --no-cache -f "@mr/cli/deployment/std/Dockerfile-next" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
        fi
      fi

      echo "${RUTA}: Añadiendo etiquetas"
      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}"
      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${HASH}"
      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${_ENTORNO}"
      if [[ -f "DESPLEGAR.txt" ]]; then
        docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:deployed_${_ENTORNO}"
      fi

      echo "${RUTA}: Subiendo contenedor"
      docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:latest"
      docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
      docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${HASH}"
      docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${_ENTORNO}"
      if [[ -f "DESPLEGAR.txt" ]]; then
        docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:deployed_${_ENTORNO}"
      fi

    else
      echo "${RUTA}: Sin cambios en el contenedor"
    fi
  }
  export -f parseWorkspace

  lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  wait

else

  if [[ -f "DESPLEGAR.txt" ]]; then
    if [[ ! -f "DESPLEGAR_LATEST.txt" ]]; then
      echo "Revisando los tags del contenedor"
      parseWorkspace() {
        RUTA="${1}"
        DIRECTORIO=$(path1 "${RUTA}")
        WORKSPACE=$(path2 "${RUTA}")

        VERSION=$(cat "${RUTA}/version.txt")
        KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

        docker pull "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
#       echo "Versiones actuales"
#       TAGS=$(gcloud artifacts docker images list "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}" --format="get(tags)" | tr ',' '\n' | grep "${VERSION}")
#       echo "${TAGS}"
#       if ! echo "${TAGS}" | grep -q "deployed_${_ENTORNO}"; then
          echo "Actualizando las etiquetas del contenedor"
          docker tag "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}" "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:deployed_${_ENTORNO}"
          docker push "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:deployed_${_ENTORNO}"
#       fi
      }

      export -f parseWorkspace

      lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
      lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
      wait
    else
      echo "Omitiendo la generación de contenedores"
    fi
  else
    echo "Omitiendo la generación de contenedores"
  fi
fi
