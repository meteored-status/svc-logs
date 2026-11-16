#!/bin/bash
set -e

ROOT="$(pwd)"
PATH="${PATH}:${ROOT}/bin:${ROOT}/@mr/cli/deployment/std/bin"

# Versión de Node con la que se construye y se ejecuta todo: el paso «Instalar Dependencias»,
# «Compilar», «Generar Documentación» y la imagen base de los contenedores (salvo que el workspace
# fije la suya en `deploy.imagen.<entorno>.base`).
#
# Sale del `.node-version` de la raíz del monorepo, que escribe `mrpack init` con la versión mayor
# que fija el framework (`NODE_VERSION` en `@mr/cli/src/clases/init/node.ts`): así local, CI y
# producción usan la misma. La sustitución opcional `_NODE_VERSION` del trigger la sustituye, para
# probar otra versión sin tocar el repo. `lts-latest` (el valor de antes) y un fichero ausente
# equivalen a la imagen `lts`, como hasta ahora.
versionNode() {
  local VERSION="${_NODE_VERSION:-}"
  if [[ -z "${VERSION}" && -f "${ROOT}/.node-version" ]]; then
    VERSION=$(tr -d '[:space:]' < "${ROOT}/.node-version")
  fi
  VERSION="${VERSION#v}"
  case "${VERSION}" in
    ""|lts-latest|lts|lts/*) VERSION="lts" ;;
  esac
  echo "${VERSION}"
}

# Imagen de Node para `docker run` y para `BASE_IMAGE`: `node:<versión>-alpine`.
imagenNode() {
  echo "node:$(versionNode)-alpine"
}

# Valor de una etiqueta del proyecto de GCP, leída con `gcloud`. Es lo mismo que hay en `labels.json`,
# pero sin esperar a que «Labels» lo escriba: «Labels» tarda ~10 s (lista los clusters y sus
# namespaces), y los pasos que solo necesitan una etiqueta pueden arrancar antes. Vacío si no existe;
# si `gcloud` falla, falla.
etiquetaProyecto() {
  gcloud projects describe "${PROJECT_ID}" --format="value(labels.${1})"
}

# Bucket de las cachés del proyecto (dependencias de Yarn y herramientas de «Descargas»): `_K8S_CACHE`
# si el trigger la define y, si no, la etiqueta `k8s-cache` del proyecto. Así «Descargar Cache
# Dependencias» arranca justo después de la guarda, en paralelo con «Descargas». Sin bucket, o si
# `gcloud` falla, no escribe nada: las cachés son una optimización y nadie falla por no tenerlas.
bucketCache() {
  if [[ -n "${_K8S_CACHE:-}" ]]; then
    echo "${_K8S_CACHE}"
  else
    etiquetaProyecto k8s-cache 2>/dev/null || true
  fi
}
