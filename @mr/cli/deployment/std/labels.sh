#!/bin/bash
set -e
PROYECTO=${PROJECT_ID:?"PROJECT_ID no definido"}
ENTORNO=${1}

echo "Obteniendo clusteres para \"${ENTORNO}\""
gcloud container clusters list --project "${PROYECTO}" --filter="resourceLabels.entorno=${ENTORNO}" --format=json > entornos.json

echo "Obteniendo labels para \"${ENTORNO}\""
gcloud projects describe "${PROYECTO}" --format=json > labels.json
