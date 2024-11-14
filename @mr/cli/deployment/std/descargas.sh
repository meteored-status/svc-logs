#!/bin/bash
################################
#### DESCARGAR HERRAMIENTAS ####
################################
set -e

download_tool() {
  local TOOL=$1
  local URL=$2
  local SALIDA=$3

  if ! command -v "${TOOL}" &> /dev/null; then
    echo "Descargando \"${TOOL}\""
    if [ -z "${SALIDA}" ]; then
      curl -sfL "${URL}" | tar xzf -
    else
      curl -sfL "${URL}" > "${SALIDA}"
    fi
  else
    cp "$(command -v "${TOOL}")" ./
  fi
  chmod +x "${TOOL}"
}

#############################
#### DESCARGAR KUSTOMIZE ####
#############################
download_tool kustomize https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv5.4.2/kustomize_v5.4.2_linux_amd64.tar.gz

#############################
#### DESCARGAR JQ ####
#############################
download_tool jq https://github.com/stedolan/jq/releases/download/jq-1.7.1/jq-linux64 jq

#############################
#### DESCARGAR SQLPROXY ####
#############################
download_tool cloud_sql_proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.linux.amd64 cloud_sql_proxy
