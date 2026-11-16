#!/bin/bash
set -e

source @mr/cli/deployment/std/aliases.sh

# Los clusters se filtran por `_CLUSTER` si el trigger la define; si no, por `_ENTORNO`, como siempre.
ENTORNO_CLUSTER="${_CLUSTER:-${_ENTORNO}}"

if opcion desplegar; then
  echo "Obteniendo clusteres para \"${ENTORNO_CLUSTER}\""
  gcloud container clusters list --project "${PROJECT_ID}" --filter="resourceLabels.entorno=${ENTORNO_CLUSTER}" --format=json > entornos.json
  # Sin ningún cluster, «Autorizar», «Kustomizar» y «Desplegar» no tienen nada que recorrer y el build
  # acababa bien sin haber desplegado nada (p. ej. con `_CLUSTER` o `_ENTORNO` mal puestos). Solo es
  # un error si hay algo que desplegar: un proyecto con solo workspaces de navegador no usa clusters.
  if [[ "$(jq 'length' entornos.json)" == "0" ]]; then
    DESPLEGABLES=$( { lw cronjobs; lw services; lw jobs; } | wc -l | tr -d ' ')
    if [[ "${DESPLEGABLES}" -gt 0 ]]; then
      echo "ERROR: no hay ningún cluster con la etiqueta entorno=${ENTORNO_CLUSTER} en ${PROJECT_ID}, y hay ${DESPLEGABLES} workspaces que desplegar"
      exit 1
    fi
  fi
  gcloud container clusters list --project "${PROJECT_ID}" --filter="(resourceLabels.entorno=${ENTORNO_CLUSTER}) AND (resourceLabels.clientes=true)" --format=json > clientes.json

  parseCluster() {
      local INDICE="${1}"
      CLUSTER=$(confige ".[${INDICE}].name")
      REGION=$(confige ".[${INDICE}].zone")

      echo "Obteniendo clientes para \"${CLUSTER}\""
      gcloud container clusters describe "${CLUSTER}" --project "${PROJECT_ID}" --zone "${REGION}" --format=json > "${CLUSTER}.json"
  }

  export -f parseCluster

  configc ". | keys | .[]" | xargs -I '{}' -P 10 bash -c "parseCluster {}"

  initCluster() {
    HASH="${1}"
    REGION="$(path1 "${HASH}")"
    NOMBRE="$(path2 "${HASH}")"
    CLUSTER="$(path3 "${HASH}")"
    CLIENTES="$(echo "${HASH}" | cut -d'/' -f4)"

    gcloud container clusters get-credentials "${NOMBRE}" --region "${REGION}" --project "${PROJECT_ID}"
    kubectl get namespaces -o json > "namespaces_raw_${CLUSTER}.json"
    jq '[.items[].metadata.name]' "namespaces_raw_${CLUSTER}.json" > "namespaces_all_${CLUSTER}.json"
    # Solo los clusters de clientes despliegan por namespace (`kustomizar.sh`).
    if [[ "${CLIENTES}" == "true" ]]; then
      jq '[.items[] | select(.metadata.labels.mrpress == "true") | .metadata.name] | join(",")' "namespaces_raw_${CLUSTER}.json" | tr -d '"' > "namespaces_${CLUSTER}.txt"
    fi
    rm "namespaces_raw_${CLUSTER}.json"
  }
  export -f initCluster

  gcloud container clusters list --project "${PROJECT_ID}" --filter="resourceLabels.entorno=${ENTORNO_CLUSTER}" --format=json | jq '.[] | [.zone, .name, .resourceLabels.zona, .resourceLabels.clientes] | join("/")' - | xargs -I '{}' -P 1 bash -c "initCluster {}"
else
  echo "Omitiendo listado de clusters"
fi

echo "Obteniendo labels para \"${_ENTORNO}\""
gcloud projects describe "${PROJECT_ID}" --format=json > labels.json
