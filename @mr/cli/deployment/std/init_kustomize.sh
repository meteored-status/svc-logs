#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  echo "Inicializando el proyecto kustomize"
  bash kustomizar/init.sh
else
    echo "Omitiendo inicialización de kustomizer"
fi
