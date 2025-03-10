#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  echo "Obteniendo clusteres para \"${_ENTORNO}\""
  gcloud container clusters list --project "${PROJECT_ID}" --filter="resourceLabels.entorno=${_ENTORNO}" --format=json > entornos.json
  gcloud container clusters list --project "${PROJECT_ID}" --filter="(resourceLabels.entorno=${_ENTORNO}) AND (resourceLabels.clientes=true)" --format=json > clientes.json

  initCluster() {
    HASH="${1}"
    REGION="$(path1 "${HASH}")"
    NOMBRE="$(path2 "${HASH}")"
    CLUSTER="$(path3 "${HASH}")"

    gcloud container clusters get-credentials "${NOMBRE}" --region "${REGION}" --project "${PROJECT_ID}"
    kubectl get namespaces -o json | jq '[.items[] | select(.metadata.labels.mrpress == "true") | .metadata.name] | join(",")' | tr -d '"' > "namespaces_${CLUSTER}.txt"
  }
  export -f initCluster

  gcloud container clusters list --project "${PROJECT_ID}" --filter="(resourceLabels.entorno=${_ENTORNO}) AND (resourceLabels.clientes=true)" --format=json | jq '.[] | [.zone, .name, .resourceLabels.zona] | join("/")' - | xargs -I '{}' -P 1 bash -c "initCluster {}"
else
  echo "Omitiendo listado de clusters"
fi

echo "Obteniendo labels para \"${_ENTORNO}\""
gcloud projects describe "${PROJECT_ID}" --format=json > labels.json
