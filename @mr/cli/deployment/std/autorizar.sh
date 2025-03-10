#!/bin/bash
##############################
##### AUTORIZACIÓN DE IPS ####
##############################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -f "DESPLEGAR.txt" ]]; then
  if [[ -z "${_AUTORIZAR}" || "${_AUTORIZAR}" == "true" ]]; then

    echo "Obteniendo IP"
    IP=$(curl -sfL http://ifconfig.me)
    echo "${IP}" > ip.txt
    echo "Obteniendo IP => ${IP}"

    parseWorkspace() {
      local IP="${1}"
      local INDICE="${2}"

      CLUSTER=$(confige ".[${INDICE}].name")
      REGION=$(confige ".[${INDICE}].zone")

      for i in {1..3}; do
        echo "${CLUSTER}: Iteración ${i}"

        local OK=false
        while [[ ${OK} != "true" ]]; do

          sleep $(( ( RANDOM % 5 )  + 1 ))

          # OBTENEMOS LA LISTA DE IPS AUTORIZADAS
          IPS=$(gcloud container clusters describe "${CLUSTER}" --region "${REGION}" --format=json | jq '.masterAuthorizedNetworksConfig.cidrBlocks[].cidrBlock' | sed 's/"//g' | tr '\r\n' ',' | sed 's/.$//' || echo "")

          if [[ "${IPS}" == "" ]]; then
            continue
          fi

          if [[ ! ${IPS} =~ ${IP} ]]; then # SI LA IP NO ESTÁ EN LA LISTA DE IPS AUTORIZADAS => HACEMOS COSAS
            # AÑADIMOS LA IP DE LA MÁQUINA A LA LISTA DE AUTORIZACIÓN
            echo "${CLUSTER}: Preautorizando IPs"
            gcloud container clusters update "${CLUSTER}" --region "${REGION}" --enable-master-authorized-networks --master-authorized-networks "${IPS},${IP}/32"

          else # SI LA IP ESTÁ EN LA LISTA DE IPS AUTORIZADAS => DESPLEGAMOS Y SALIMOS DEL BUCLE
            echo "${CLUSTER}: IP autorizada"
            OK=true
          fi

        done

      done
    }

    export -f parseWorkspace
    confige ". | keys | .[]" | xargs -I '{}' -P 10 bash -c "parseWorkspace ${IP} {}"

  else
    echo "No se necesita autorizar la IP"
  fi
else
    echo "Omitiendo autorización"
fi
