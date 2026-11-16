#!/bin/bash
##############################
##### AUTORIZACIÓN DE IPS ####
##############################
set -e

source @mr/cli/deployment/std/aliases.sh

if opcion desplegar; then
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
      INTENTOS=0
      while [[ ${OK} != "true" ]]; do
        # Con tope, como en autorizar.sh: si `gcloud` no devolvía la lista, o solo quedaba nuestra IP
        # (la lista filtrada sale vacía), seguía hasta el timeout del build. Falla en vez de acabar
        # bien, porque deja la IP del worker autorizada en el cluster.
        INTENTOS=$((INTENTOS + 1))
        if [[ ${INTENTOS} -gt 20 ]]; then
          echo "ERROR: ${CLUSTER}: no se ha podido desautorizar la IP ${IP} en 20 intentos; queda autorizada"
          exit 1
        fi
        IPS=$(gcloud container clusters describe "${CLUSTER}" --region "${REGION}" --format=json | jq ".masterAuthorizedNetworksConfig.cidrBlocks[].cidrBlock | select(.!=\"${IP}/32\")" | sed 's/"//g' | tr '\r\n' ',' | sed 's/.$//' || true)

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
