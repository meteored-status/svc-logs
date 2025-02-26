#!/bin/bash
##############################
##### AUTORIZACIÓN DE IPS ####
##############################
set -e

if [[ -z "${_AUTORIZAR}" || "${_AUTORIZAR}" == "true" ]]; then

  echo "Obteniendo IP"
  IP=$(cat ip.txt)

  parseWorkspace() {
    local IP="${1}"
    local INDICE="${2}"
    CLUSTER=$(./jq -r ".[${INDICE}].name" "entornos.json")
    REGION=$(./jq -r ".[${INDICE}].zone" "entornos.json")

    echo "${CLUSTER}: Limpiando"
    # LIMPIAMOS EL CLUSTER
    OK=false
    while [[ ${OK} != "true" ]]; do
    #  IP=$(cat ip.txt)
      IPS=$(gcloud container clusters describe "${CLUSTER}" --region "${REGION}" --format=json | ./jq ".masterAuthorizedNetworksConfig.cidrBlocks[].cidrBlock | select(.!=\"${IP}/32\")" | sed 's/"//g' | tr '\r\n' ',' | sed 's/.$//' || "")

      if [[ "${IPS}" == "" ]]; then
        sleep $(( ( RANDOM % 5 )  + 1 ))
        continue
      fi

      echo "${CLUSTER}: Desautorizando IP"
      gcloud container clusters update "${CLUSTER}" --region "${REGION}" --enable-master-authorized-networks --master-authorized-networks "${IPS}" || sleep $(( ( RANDOM % 5 )  + 1 ))

      IPS=$(gcloud container clusters describe "${CLUSTER}" --region "${REGION}" --format=json | ./jq '.masterAuthorizedNetworksConfig.cidrBlocks[].cidrBlock' | sed 's/"//g' | tr '\r\n' ',' | sed 's/.$//')
      if [[ ! ${IPS} =~ ${IP} ]]; then
        OK=true
      else
        sleep $(( ( RANDOM % 5 )  + 1 ))
      fi
    done
  }
  export -f parseWorkspace

  ./jq -r ". | keys | .[]" "entornos.json" | xargs -I '{}' -P 10 bash -c "parseWorkspace ${IP} {}"

else
  echo "No se necesita desautorizar la IP"
fi
