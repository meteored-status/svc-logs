#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

# Imagen base por defecto (la versión de Node del monorepo, ver `versionNode()` en aliases.sh). Se
# resuelve aquí y se exporta porque `parseWorkspace` corre en un `bash -c` aparte, donde las
# funciones de aliases.sh no existen.
export IMAGEN_NODE
IMAGEN_NODE=$(imagenNode)
echo "Imagen base por defecto: ${IMAGEN_NODE}"

if opcion generar; then
  mkdir -p .yarn/plugins

  # El builder solo hace falta si algún workspace tiene imagen nueva (`nuevo.txt`, de «Compilar»).
  # Arrancarlo lleva unos 5 s —descarga la imagen de buildkit y crea su contenedor—, y en un despliegue
  # sin cambios eran casi todo lo que tardaba este paso. Buscar en los tres grupos, y no solo en los de
  # `lw`, puede arrancarlo de más, nunca de menos: los workspaces de `lw` están todos en esos tres.
  NUEVOS=$(find cronjobs services jobs -mindepth 2 -maxdepth 2 -name nuevo.txt -print 2>/dev/null || true)
  if [[ -n "${NUEVOS}" ]]; then
    #docker run --privileged --rm tonistiigi/binfmt --install all
    docker buildx create --name mrpack --driver docker-container --use
    docker buildx inspect --bootstrap
  else
    echo "Ningún workspace tiene imagen nueva: no se arranca buildkit"
  fi

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
        BASE_IMAGE="${IMAGEN_NODE}"
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
        ARCH="linux/amd64"
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
      if opcion desplegar; then
        DEPLOYED="deployed"
      else
        DEPLOYED="retained"
      fi

      # Caché de capas entre despliegues, guardada en el propio registro porque el builder se crea
      # vacío en cada build y no sobrevive de uno a otro. `mode=max` no es opcional: la capa que
      # interesa reutilizar —el `yarn workspaces focus`— vive en una etapa intermedia que no llega a
      # la imagen final, y el modo por defecto solo guarda las capas publicadas. Va por entorno
      # porque la imagen base puede diferir entre test y producción. `image-manifest` y
      # `oci-mediatypes` son requisito de Artifact Registry, que rechaza el formato por defecto de
      # buildkit. Con `ignore-error` un fallo al escribir la caché no tumba el despliegue.
      # `compression=zstd`: con `mode=max` buildkit tiene que comprimir todas las capas de las etapas
      # intermedias, que no se suben con la imagen, y en gzip eso le llevaba 29 de los 35 s de la
      # exportación de la caché del frontend. Solo afecta a la caché: la imagen que se despliega
      # sigue en gzip.
      CACHE="${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:buildcache_${_ENTORNO}"

      # `BUILDX_GIT_INFO=0`: buildx intenta apuntar el commit y la URL del repo en los metadatos de
      # procedencia de la imagen ejecutando `git`, y la imagen `gcr.io/cloud-builders/docker` de los
      # workers `regular` (Docker 29) no lo trae: avisaba con «git was not found» en cada build. No
      # se pierde nada, porque el commit ya va en la imagen con `DD_GIT_COMMIT_SHA`.
      BUILDX_GIT_INFO=0 docker buildx build \
        --platform "${ARCH}" \
        --file "${DOCKERFILE}" \
        --cache-from "type=registry,ref=${CACHE}" \
        --cache-to "type=registry,ref=${CACHE},mode=max,image-manifest=true,oci-mediatypes=true,compression=zstd,ignore-error=true" \
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
  lw jobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" &
  PID3=$!
  wait $PID1
  STATUS1=$?
  wait $PID2
  STATUS2=$?
  wait $PID3
  STATUS3=$?
  if [[ $STATUS1 -ne 0 || $STATUS2 -ne 0 || $STATUS3 -ne 0 ]]; then
    echo "Error generando contenedor"
    exit 1
  fi
else
  # Sin imagen nueva no hay nada que etiquetar: `mrpack` mantiene la versión desplegada
  # (`deployed.json`, con el `deploy.run.latest: false` de los `mrpack.json`) y se vuelve a desplegar
  # esa. Antes, con `_DESPLEGAR_LATEST=false`, se volvía a etiquetar como `deployed-<entorno>`, con
  # guion, que `tags.sh` (`deployed_<entorno>`) no leía.
  echo "Omitiendo la generación de contenedores"
fi
