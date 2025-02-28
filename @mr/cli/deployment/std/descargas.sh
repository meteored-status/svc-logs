#!/bin/bash
################################
#### DESCARGAR HERRAMIENTAS ####
################################
set -e

mkdir -p bin

chmod +x @mr/cli/deployment/std/bin/*
source @mr/cli/deployment/std/aliases.sh

download_tool() {
  local TOOL=$1
  local URL=$2
  local SALIDA=$3

  if ! command -v "${TOOL}" &> /dev/null; then
    echo "Descargando \"${TOOL}\""
    if [ -z "${SALIDA}" ]; then
      curl -sfL "${URL}" | tar xzf - -C bin
      curl -sfL "${URL}" | tar xzf -
    else
      curl -sfL "${URL}" > "bin/${SALIDA}"
      cp "bin/${SALIDA}" "${SALIDA}"
    fi
  else
    cp "$(command -v "${TOOL}")" ./bin/
    cp "$(command -v "${TOOL}")" ./
  fi
  chmod +x "bin/${TOOL}"
  chmod +x "${TOOL}"
}

#############################
#### DESCARGAR JQ ####
#############################
download_tool jq https://github.com/stedolan/jq/releases/download/jq-1.7.1/jq-linux64 jq

##########################################
#### DETERMINAR LAS OPCIONES DE CI/CD ####
##########################################
if [[ "${_DESPLEGAR}" == "true" || "${_DESPLEGAR}" == "1" ]]; then
  echo "" > DESPLEGAR.txt
  echo "_DESPLEGAR=true" >> .env
elif [[ "${_DESPLEGAR}" == "false" || "${_DESPLEGAR}" == "0" ]]; then
  echo "_DESPLEGAR=false" >> .env
elif [[ "$(configg .deploy.run.enabled)" == "false" ]]; then
  echo "_DESPLEGAR=false" >> .env
else
  echo "" > DESPLEGAR.txt
  echo "_DESPLEGAR=true" >> .env
fi

if [[ "${_DESPLEGAR_LATEST}" == "true" || "${_DESPLEGAR_LATEST}" == "1" ]]; then
  echo "" > DESPLEGAR_LATEST.txt
  echo "_DESPLEGAR_LATEST=true" >> .env
elif [[ "${_DESPLEGAR_LATEST}" == "false" || "${_DESPLEGAR_LATEST}" == "0" ]]; then
  echo "_DESPLEGAR_LATEST=false" >> .env
elif [[ "$(configg .deploy.run.latest)" == "false" ]]; then
  echo "_DESPLEGAR_LATEST=false" >> .env
else
  echo "" > DESPLEGAR_LATEST.txt
  echo "_DESPLEGAR_LATEST=true" >> .env
fi

if [[ "${_GENERAR}" == "true" || "${_GENERAR}" == "1" ]]; then
  echo "" > GENERAR.txt
  echo "_GENERAR=true" >> .env
elif [[ "${_GENERAR}" == "false" || "${_GENERAR}" == "0" ]]; then
  echo "_GENERAR=false" >> .env
elif [[ "$(configg .deploy.build.enabled)" == "false" ]]; then
  echo "_GENERAR=false" >> .env
else
  echo "" > GENERAR.txt
  echo "_GENERAR=true" >> .env
fi

if [[ "${_GENERAR_FORZAR}" == "true" || "${_GENERAR_FORZAR}" == "1" ]]; then
  echo "_GENERAR_FORZAR=true" >> .env
elif [[ "${_GENERAR_FORZAR}" == "false" || "${_GENERAR_FORZAR}" == "0" ]]; then
  echo "_GENERAR_FORZAR=false" >> .env
elif [[ "$(configg .deploy.build.force)" == "true" ]]; then
  echo "_GENERAR_FORZAR=true" >> .env
else
  echo "_GENERAR_FORZAR=false" >> .env
fi

#if [[ -f ".env" ]]; then
#  cat .env
#fi

#############################
#### DESCARGAR KUSTOMIZE ####
#############################
download_tool kustomize https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv5.4.2/kustomize_v5.4.2_linux_amd64.tar.gz

#############################
#### DESCARGAR SQLPROXY ####
#############################
download_tool cloud_sql_proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.linux.amd64 cloud_sql_proxy
