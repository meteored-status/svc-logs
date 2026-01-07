#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "GENERAR.txt" ]]; then
  mkdir -p .yarn/plugins

  #docker run --privileged --rm tonistiigi/binfmt --install all
  docker buildx create --name mrpack --driver docker-container --use
  docker buildx inspect --bootstrap

  parseWorkspace() {
    RUTA="${1}"
    DIRECTORIO=$(path1 "${RUTA}")
    WORKSPACE=$(path2 "${RUTA}")

    VERSION=$(cat "${RUTA}/version.txt")
#    KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

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

      BASE_IMAGE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .base // empty")
      if [[ -z "${BASE_IMAGE}" || "${BASE_IMAGE}" == "null" ]]; then
        BASE_IMAGE="node:lts-alpine"
      else
        BASE_IMAGE=$(echo "${BASE_IMAGE}" | sed "s/\${PROJECT_ID}/${PROJECT_ID}/g")
      fi
      REGISTRO=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .registro // empty")
      if [[ -z "${REGISTRO}" || "${REGISTRO}" == "null" ]]; then
        REGISTRO="europe-west1-docker.pkg.dev"
      fi
      PAQUETE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .paquete // empty")
      if [[ -z "${PAQUETE}" || "${PAQUETE}" == "null" ]]; then
        PAQUETE="services"
      fi
      NOMBRE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .nombre // empty")
      if [[ -z "${NOMBRE}" || "${NOMBRE}" == "null" ]]; then
        NOMBRE="${WORKSPACE}"
      fi
      echo "${RUTA}: ${BASE_IMAGE}"
      ARCH=$(configw "${RUTA}" '.deploy.arch // empty | select(type == "array") | join(",")')
      if [[ -z "$ARCH" || "$ARCH" == "" ]]; then
        ARCH="linux/amd64,linux/arm64"
      fi

      if [[ -f ${RUTA}/Dockerfile ]]; then
        echo "${RUTA}: Custom Dockerfile (${ARCH})"
        DOCKERFILE="${RUTA}/Dockerfile"
#        docker build --no-cache -f "${DOCKERFILE}" --build-arg  PROYECTO="${PROJECT_ID}" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" --build-arg DD_GIT_REPOSITORY_URL="${REPO_FULL_NAME}" --build-arg DD_GIT_COMMIT_SHA="${COMMIT_SHA}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
      else
        if [[ $(configw "${RUTA}" .build.framework) != "nextjs" ]]; then
          echo "${RUTA}: Generic Meteored Dockerfile (${ARCH})"
          DOCKERFILE="@mr/cli/deployment/std/Dockerfile"
#          docker build --no-cache -f "${DOCKERFILE}" --build-arg  PROYECTO="${PROJECT_ID}" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" --build-arg DD_GIT_REPOSITORY_URL="${REPO_FULL_NAME}" --build-arg DD_GIT_COMMIT_SHA="${COMMIT_SHA}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
        else
          echo "${RUTA}: Generic Next Dockerfile (${ARCH})"
          DOCKERFILE="@mr/cli/deployment/std/Dockerfile-next"
#          docker build --no-cache -f "${DOCKERFILE}" --build-arg  PROYECTO="${PROJECT_ID}" --build-arg  RUTA="${DIRECTORIO}" --build-arg  WS="${WORKSPACE}" --build-arg  BASE_IMAGE="${BASE_IMAGE}" --build-arg DD_GIT_REPOSITORY_URL="${REPO_FULL_NAME}" --build-arg DD_GIT_COMMIT_SHA="${COMMIT_SHA}" -t "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" .
        fi
      fi
      if [[ -f "DESPLEGAR.txt" ]]; then
        DEPLOYED="deployed"
      else
        DEPLOYED="retained"
      fi

      docker buildx build \
        --platform "${ARCH}" \
        --file "${DOCKERFILE}" \
        --build-arg PROYECTO="${PROJECT_ID}" \
        --build-arg RUTA="${DIRECTORIO}" \
        --build-arg WS="${WORKSPACE}" \
        --build-arg BASE_IMAGE="${BASE_IMAGE}" \
        --build-arg DD_GIT_REPOSITORY_URL="${REPO_FULL_NAME}" \
        --build-arg DD_GIT_COMMIT_SHA="${COMMIT_SHA}" \
        --tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:latest" \
        --tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}" \
        --tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${HASH}" \
        --tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${_ENTORNO}" \
        --tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${DEPLOYED}_${_ENTORNO}" \
        --push .

#      echo "${RUTA}: Añadiendo etiquetas"
#      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}"
#      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}"
#      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${HASH}"
#      docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${_ENTORNO}"
#      if [[ -f "DESPLEGAR.txt" ]]; then
#        docker tag "${PROJECT_ID}/${DIRECTORIO}-${WORKSPACE}" "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:deployed_${_ENTORNO}"
#      fi
#
#      echo "${RUTA}: Subiendo contenedor"
#      docker push "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:latest"
#      docker push "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}"
#      docker push "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${HASH}"
#      docker push "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${_ENTORNO}"
#      if [[ -f "DESPLEGAR.txt" ]]; then
#        docker push "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:deployed-${_ENTORNO}"
#      fi

    else
      echo "${RUTA}: Sin cambios en el contenedor"
    fi
  }
  export -f parseWorkspace

  lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  PID1=$!
  lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  PID2=$!
  wait $PID1
  STATUS1=$?
  wait $PID2
  STATUS2=$?
  if [[ $STATUS1 -ne 0 || $STATUS2 -ne 0 ]]; then
    echo "Error generando contenedor"
    exit 1
  fi
else

  if [[ -f "DESPLEGAR.txt" ]]; then
    if [[ ! -f "DESPLEGAR_LATEST.txt" ]]; then
      echo "Revisando los tags del contenedor"

      docker buildx create --name mrpack --driver docker-container --use
      docker buildx inspect --bootstrap

      parseWorkspace() {
        RUTA="${1}"
        DIRECTORIO=$(path1 "${RUTA}")
        WORKSPACE=$(path2 "${RUTA}")

        VERSION=$(cat "${RUTA}/version.txt")
#        KUSTOMIZER=$(configw "${RUTA}" .deploy.kustomize.legacy)

        REGISTRO=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .registro // empty")
        if [[ -z "${REGISTRO}" || "${REGISTRO}" == "null" ]]; then
          REGISTRO="europe-west1-docker.pkg.dev"
        fi
        PAQUETE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .paquete // empty")
        if [[ -z "${PAQUETE}" || "${PAQUETE}" == "null" ]]; then
          PAQUETE="services"
        fi
        NOMBRE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .nombre // empty")
        if [[ -z "${NOMBRE}" || "${NOMBRE}" == "null" ]]; then
          NOMBRE="${WORKSPACE}"
        fi

        docker buildx imagetools create \
          --tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:deployed-${_ENTORNO}" \
          "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}"

#        docker pull "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}"
##       echo "Versiones actuales"
##       TAGS=$(gcloud artifacts docker images list "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}" --format="get(tags)" | tr ',' '\n' | grep "${VERSION}")
##       echo "${TAGS}"
##       if ! echo "${TAGS}" | grep -q "deployed_${_ENTORNO}"; then
#          echo "Actualizando las etiquetas del contenedor"
#          docker tag "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}" "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:deployed-${_ENTORNO}"
#          docker push "${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:deployed-${_ENTORNO}"
##       fi
      }

      export -f parseWorkspace

      lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
      PID1=$!
      lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
      PID2=$!
      wait $PID1
      STATUS1=$?
      wait $PID2
      STATUS2=$?
      if [[ $STATUS1 -ne 0 || $STATUS2 -ne 0 ]]; then
        echo "Error tageando contenedor"
        exit 1
      fi
    else
      echo "Omitiendo la generación de contenedores"
    fi
  else
    echo "Omitiendo la generación de contenedores"
  fi
fi
