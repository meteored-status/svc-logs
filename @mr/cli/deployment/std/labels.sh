#!/bin/bash
set -e

echo "Obteniendo clusteres para \"${_ENTORNO}\""
gcloud container clusters list --project "${PROJECT_ID}" --filter="resourceLabels.entorno=${_ENTORNO}" --format=json > entornos.json

echo "Obteniendo labels para \"${_ENTORNO}\""
gcloud projects describe "${PROJECT_ID}" --format=json > labels.json
