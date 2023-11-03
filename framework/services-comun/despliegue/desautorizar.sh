#!/bin/bash
##############################
##### AUTORIZACIÓN DE IPS ####
##############################
set -e
# OBTENEMOS LA IP DE LA MÁQUINA
echo "Obteniendo IP"
IP=$(cat ip.txt)

ENTORNO="${1}"

parseWorkspace() {
  local ENTORNO="${1}"
  local IP="${2}"
  local INDICE="${3}"
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

./jq -r ". | keys | .[]" "entornos.json" | xargs -I '{}' -P 10 bash -c "parseWorkspace ${ENTORNO} ${IP} {}"
