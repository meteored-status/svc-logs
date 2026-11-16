#!/bin/bash
################################
#### DESCARGAR HERRAMIENTAS ####
################################
set -e

ROOT="$(pwd)"
mkdir -p "${ROOT}/bin"

chmod +x @mr/cli/deployment/std/bin/*
source @mr/cli/deployment/std/aliases.sh

# Herramientas del pipeline, con versión y sha256 fijos. Antes se bajaban de GitHub en cada build, y
# `yq` además de `releases/latest`: una caída o un límite de peticiones de GitHub tumbaba el
# despliegue, y `yq` podía cambiar entre un build y el siguiente.
#
# Cada una se busca primero en la caché del proyecto, `gs://<bucket>/herramientas/`, donde `<bucket>`
# es `_K8S_CACHE` o, si el trigger no la define, la etiqueta `k8s-cache` del proyecto (el mismo de la
# caché de Yarn, ver `bucketCache()` en aliases.sh). Si no está,
# se baja de la URL oficial con reintentos y se sube a la caché para los siguientes builds. Venga de
# donde venga, se comprueba su sha256 y, si no coincide, el build falla.
#
# Para subir una versión: cambiar versión, URL y sha256 aquí, con el sha256 oficial del proyecto.
# Versiones fijadas el 2026-11-09 con sus sumas oficiales (yq 4.54.3 tenía horas, se fijó la anterior).
JQ_VERSION="1.8.2"
JQ_SHA256="b1c22172dd303f3be49e935aa56aa48a8b7a46e0bc838b4997d3bb451495870f"
YQ_VERSION="v4.54.2"
YQ_SHA256="44c7759059b4910827a0059a2757b22001e59360cdecdb2ef8dedc4b6c7e9f32"
KUSTOMIZE_VERSION="v5.8.3"
KUSTOMIZE_SHA256="cb9e31198d3f63b44848bd0afc4c8efc56e6cfef9c93a4a39a211940e6decd61"
SQLPROXY_VERSION="v2.27.0"
SQLPROXY_SHA256="39ed2abcaa073c3b4714585e36a904e2b1d92218c5e07c18224fb73ef4bedde5"

BUCKET=$(bucketCache)
DESCARGAS=$(mktemp -d)

# herramienta NOMBRE ARCHIVO URL SHA256 [tar]: deja `bin/NOMBRE` en la raíz del repo.
herramienta() {
  local NOMBRE="${1}"
  local ARCHIVO="${2}"
  local URL="${3}"
  local SHA256="${4}"
  local TIPO="${5:-}"
  local LOCAL="${DESCARGAS}/${ARCHIVO}"
  local ORIGEN

  if [[ -n "${BUCKET}" ]] \
    && gcloud storage cp --no-user-output-enabled "gs://${BUCKET}/herramientas/${ARCHIVO}" "${LOCAL}" 2>/dev/null \
    && echo "${SHA256}  ${LOCAL}" | sha256sum -c --status; then
    ORIGEN="caché gs://${BUCKET}/herramientas"
  else
    curl -sfL --retry 3 --retry-delay 2 -o "${LOCAL}" "${URL}"
    if ! echo "${SHA256}  ${LOCAL}" | sha256sum -c --status; then
      echo "ERROR: el sha256 de ${ARCHIVO} no es el esperado (${SHA256}); no se usa"
      exit 1
    fi
    ORIGEN="${URL}"
    if [[ -n "${BUCKET}" ]]; then
      gcloud storage cp --no-user-output-enabled "${LOCAL}" "gs://${BUCKET}/herramientas/${ARCHIVO}" \
        || echo "AVISO: no se pudo guardar ${ARCHIVO} en gs://${BUCKET}/herramientas"
    fi
  fi

  if [[ "${TIPO}" == "tar" ]]; then
    tar xzf "${LOCAL}" -C "${ROOT}/bin" "${NOMBRE}"
  else
    cp "${LOCAL}" "${ROOT}/bin/${NOMBRE}"
  fi
  chmod +x "${ROOT}/bin/${NOMBRE}"
  echo "${NOMBRE} ${ARCHIVO}: ${ORIGEN}"
}

#############################
#### DESCARGAR JQ ####
#############################
herramienta jq "jq-${JQ_VERSION}-linux-amd64" "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-amd64" "${JQ_SHA256}"

##########################################
#### DETERMINAR LAS OPCIONES DE CI/CD ####
##########################################
# Ya no se guardan en ficheros (`DESPLEGAR.txt`, `GENERAR.txt`, `DESPLEGAR_LATEST.txt`, `.env`): cada
# paso las calcula con `opcion` (bin/opcion). Aquí se resuelven todas una vez, para dejarlas en el log
# y para que el build falle aquí si alguna no se puede resolver, en vez de que un `if` posterior la
# tome por «no».
for OPCION in desplegar generar generar-forzar; do
  VALOR=$(opcion --valor "${OPCION}")
  echo "Opción ${OPCION}: ${VALOR}"
done

#############################
#### DESCARGAR YQ ####
#############################
herramienta yq "yq-${YQ_VERSION}-linux-amd64" "https://github.com/mikefarah/yq/releases/download/${YQ_VERSION}/yq_linux_amd64" "${YQ_SHA256}"

#############################
#### DESCARGAR KUSTOMIZE ####
#############################
herramienta kustomize "kustomize_${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2F${KUSTOMIZE_VERSION}/kustomize_${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" "${KUSTOMIZE_SHA256}" tar

#############################
#### DESCARGAR SQLPROXY ####
#############################
if [[ -n "${_MYSQL}" || -n "${_MYSQL_DOC}" ]]; then
  herramienta cloud_sql_proxy "cloud-sql-proxy-${SQLPROXY_VERSION}.linux.amd64" "https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/${SQLPROXY_VERSION}/cloud-sql-proxy.linux.amd64" "${SQLPROXY_SHA256}"
fi

rm -rf "${DESCARGAS}"
