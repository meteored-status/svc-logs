#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  echo "Obteniendo clusteres para \"${_ENTORNO}\""
  gcloud container clusters list --project "${PROJECT_ID}" --filter="resourceLabels.entorno=${_ENTORNO}" --format=json > entornos.json
else
    echo "Omitiendo listado de clusters"
fi

echo "Obteniendo labels para \"${_ENTORNO}\""
gcloud projects describe "${PROJECT_ID}" --format=json > labels.json
