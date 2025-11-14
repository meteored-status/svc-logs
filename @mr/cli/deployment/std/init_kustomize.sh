#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  echo "Inicializando el proyecto kustomize"

#  TIPOS=(credenciales ssl)
#
#  parseZona() {
#    TIPO="${1}"
#    RUTA="${2}"
#    ZONA="${3}"
#
#    configw "${RUTA}" ".deploy.kustomize.${TIPO} // {} | .[] | gsub(\"\\\\{ENTORNO\\\\}\"; \"${_ENTORNO}\") | gsub(\"\\\\{ZONA\\\\}\"; \"${ZONA}\")" >> "${TIPO}.txt"
#  }
#  export -f parseZona
#
#  parseWorkspace() {
#    RUTA="${1}"
#
#    for TIPO in "${TIPOS[@]}"; do
#      if configw "${RUTA}" ".deploy?.kustomize?.${TIPO}" | grep -q true; then
#        confige '.[] | .resourceLabels.zona' | xargs -I '{}' bash -c "parseZona ${TIPO} ${RUTA} {}"
#      fi
#    done
#
#  }
#  export -f parseWorkspace
#
#  lw cronjobs | xargs -I '{}' bash -c "parseWorkspace {}"
#  lw services | xargs -I '{}' bash -c "parseWorkspace {}"
#
#  for TIPO in "${TIPOS[@]}"; do
#    if [[ -f "${TIPO}.txt" ]]; then
#      sort "${TIPO}.txt" | uniq > "${TIPO}.tmp" && mv "${TIPO}.tmp" "${TIPO}.txt"
#      echo "Recursos kustomize de tipo ${TIPO}:"
#      cat "${TIPO}.txt"
#    fi
#  done

  bash kustomizar/init.sh "${_ENTORNO}"
else
  echo "Omitiendo inicialización de kustomizer"
fi
