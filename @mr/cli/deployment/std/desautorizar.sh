#!/bin/bash
##############################
##### AUTORIZACIÓN DE IPS ####
##############################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  if [[ -z "${_AUTORIZAR}" || "${_AUTORIZAR}" == "true" ]]; then

    echo "Obteniendo IP"
    IP=$(cat ip.txt)

    parseWorkspace() {
      local IP="${1}"
      local INDICE="${2}"
      CLUSTER=$(confige ".[${INDICE}].name")
      REGION=$(confige ".[${INDICE}].zone")

      echo "${CLUSTER}: Limpiando"
      # LIMPIAMOS EL CLUSTER
      OK=false
      while [[ ${OK} != "true" ]]; do
      #  IP=$(cat ip.txt)
        IPS=$(gcloud container clusters describe "${CLUSTER}" --region "${REGION}" --format=json | jq ".masterAuthorizedNetworksConfig.cidrBlocks[].cidrBlock | select(.!=\"${IP}/32\")" | sed 's/"//g' | tr '\r\n' ',' | sed 's/.$//' || "")

        if [[ "${IPS}" == "" ]]; then
          sleep $(( ( RANDOM % 5 )  + 1 ))
          continue
        fi

        echo "${CLUSTER}: Desautorizando IP"
        gcloud container clusters update "${CLUSTER}" --region "${REGION}" --enable-master-authorized-networks --master-authorized-networks "${IPS}" || sleep $(( ( RANDOM % 5 )  + 1 ))

        IPS=$(gcloud container clusters describe "${CLUSTER}" --region "${REGION}" --format=json | jq '.masterAuthorizedNetworksConfig.cidrBlocks[].cidrBlock' | sed 's/"//g' | tr '\r\n' ',' | sed 's/.$//')
        if [[ ! ${IPS} =~ ${IP} ]]; then
          OK=true
        else
          sleep $(( ( RANDOM % 5 )  + 1 ))
        fi
      done
    }
    export -f parseWorkspace

    confige ". | keys | .[]" | xargs -I '{}' -P 10 bash -c "parseWorkspace ${IP} {}"

  else
    echo "No se necesita desautorizar la IP"
  fi
else
    echo "Omitiendo desautorización"
fi
