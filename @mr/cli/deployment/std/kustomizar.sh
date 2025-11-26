#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

BASETOP=$(pwd)

export BASETOP

if [[ -f "DESPLEGAR.txt" ]]; then
  updateImagen() {
    KUSTOMIZER="${1}"
    DIR="${2}"
    WORKSPACE="${3}"
    VERSION="${4}"

    cd "${DIR}"
    kustomize edit set image "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
    kustomize edit set image "europe-west1-docker.pkg.dev/\\\${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}:${VERSION}"
    cd "${BASETOP}"
  }
  export -f updateImagen

  parseWorkspaceEjecutar() {
    DIR="${1}"
    WORKSPACE="${2}"
    SERVICIO="${3}"
    VERSION="${4}"
    KUSTOMIZER="${5}"
    CLUSTER="${6}"

    updateImagen "${KUSTOMIZER}" "${DIR}" "${WORKSPACE}" "${VERSION}"
    kustomize build "${DIR}" | sed "s/\${PROJECT_ID}/${PROJECT_ID}/g" | sed "s/\${ZONA}/${CLUSTER}/g" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml" || exit 1
    echo "---" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml"
  }
  export -f parseWorkspaceEjecutar

  parseWorkspaceCluster() {
    DIRECTORIO="${1}"
    WORKSPACE="${2}"
    SERVICIO="${3}"
    VERSION="${4}"
    KUSTOMIZER="${5}"
    CLUSTER="${6}"

    ALL="kustomizar/${KUSTOMIZER}/${SERVICIO}/_all"
    ENTORNOS="kustomizar/${KUSTOMIZER}/${SERVICIO}/entornos"
    CLIENTES="kustomizar/${KUSTOMIZER}/${SERVICIO}/clientes"

    if [[ -d "${ALL}" ]]; then
      if [[ "${CLUSTER}" == "test" ]]; then
        ENTORNO="test"
      else
        ENTORNO="produccion"
      fi

      ## todo el nombre de la imagen no se usa de cara al kustomize
#      NOMBRE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .nombre // empty")
#      if [[ -z "${NOMBRE}" || "${NOMBRE}" == "null" ]]; then
#        NOMBRE="${WORKSPACE}"
#      fi

#      CLIENTE="${7:-*}"
      bash "kustomizar/build.sh" "${PROJECT_ID}" "${KUSTOMIZER}" "${SERVICIO}" "${ENTORNO}" "${CLUSTER}" "${VERSION}" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml" || exit 1
      echo "---" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml"

    elif [[ -d "${ENTORNOS}" ]]; then
      if [[ -d "${ENTORNOS}/${CLUSTER}" ]]; then
        parseWorkspaceEjecutar "${ENTORNOS}/${CLUSTER}" "${WORKSPACE}" "${SERVICIO}" "${VERSION}" "${KUSTOMIZER}" "${CLUSTER}" || exit 1
      fi
    elif [[ -d "${CLIENTES}" ]]; then
      IFS=',' read -r -a NAMESPACES <<< "$(cat "namespaces_${CLUSTER}.txt")"
      for NAMESPACE in "${NAMESPACES[@]}"; do
        DIR="${CLIENTES}/${NAMESPACE}/${CLUSTER}"
        if [[ -d "${DIR}" ]]; then
          parseWorkspaceEjecutar "${DIR}" "${WORKSPACE}" "${SERVICIO}" "${VERSION}" "${KUSTOMIZER}" "${CLUSTER}" || exit 1
        fi
      done
    fi
  }
  export -f parseWorkspaceCluster

  parseWorkspace() {
    RUTA="${1}"
    DIRECTORIO=$(path1 "${RUTA}")
    WORKSPACE=$(path2 "${RUTA}")

    confige ".[].resourceLabels.zona" | xargs -I '{}' -P 1 bash -c "echo \"# ${WORKSPACE}\" > despliegue_${WORKSPACE}_{}.yaml"

    VERSION=$(cat "${RUTA}/version.txt" || echo "0000.00.00")
    KUSTOMIZE_ARRAY=$(configw "${RUTA}" '.deploy.kustomize')
    LENGTH=$(echo "${KUSTOMIZE_ARRAY}" | jq 'length')
    for ((i=0; i<LENGTH; i++)); do
      SERVICIO=$(echo "${KUSTOMIZE_ARRAY}" | jq -r ".[$i].name")
      KUSTOMIZER=$(echo "${KUSTOMIZE_ARRAY}" | jq -r ".[$i].dir")

      echo "${WORKSPACE} (${SERVICIO}): Versión ${VERSION}"

      if [[ "$(configw "${RUTA}" '.deploy.target')" == "k8s" ]]; then
        ZONAS=$(confige '.[] | .resourceLabels.zona')
        for ZONA in ${ZONAS}; do
          parseWorkspaceCluster "${DIRECTORIO}" "${WORKSPACE}" "${SERVICIO}" "${VERSION}" "${KUSTOMIZER}" "${ZONA}"
          STATUS=$?
          if [[ $STATUS -ne 0 ]]; then
            echo "Error ejecutando kustomize para ${WORKSPACE} (${SERVICIO}) en ${ZONA}"
            exit 1
          fi
        done
      elif [[ "$(configw "${RUTA}" '.deploy.target')" == "lambda" ]]; then
        if [[ ! -f "${BASETOP}/lambda.sh" ]]; then
          echo "#!/bin/bash" > "${BASETOP}/lambda.sh"
          echo "set -e" >> "${BASETOP}/lambda.sh"
          echo "" >> "${BASETOP}/lambda.sh"
        fi
        cat "${BASETOP}/@mr/cli/deployment/std/cloud-run.yml" | sed "s/\${PROJECT_ID}/${PROJECT_ID}/g" | sed "s/\${KUSTOMIZER}/${KUSTOMIZER}/g" | sed "s/\${IMAGEN}/${SERVICIO}/g" | sed "s/\${VERSION}/${VERSION}/g" | sed "s/\${ENTORNO}/${_ENTORNO}/g" > "${BASETOP}/${KUSTOMIZER}-${SERVICIO}.yml"
        CLOUDSQL=$(configw "${RUTA}" '.deploy.cloudsql // empty | if type=="array" and length > 0 then join(",") else empty end')
        if [[ -n "${CLOUDSQL}" ]]; then
          CLOUDSQL=" --set-cloudsql-instances=${CLOUDSQL}"
        else
          CLOUDSQL=""
        fi
        VOLUMES_JSON='[]'
        MOUNTS_JSON='[]'
        COUNTER=0
        CREDENTIALS=$(configw "${RUTA}" '.deploy.credenciales // []')
        if [[ "$CREDENTIALS" != "[]" ]]; then
          while IFS= read -r item; do
            SOURCE=$(echo "$item" | jq -r '.source')
            TARGET=$(echo "$item" | jq -r '.target')
            VOL_NAME="creds-vol-$COUNTER"

            VOLUME_ENTRY=$(jq -n \
              --arg name "$VOL_NAME" \
              --arg secret_name "$SOURCE" \
              --arg path "$TARGET" \
              '{
                  name: $name,
                  secret: {
                      secretName: $secret_name,
                      items: [{key: "latest", path: $path}]
                  }
              }')
            VOLUMES_JSON=$(echo "$VOLUMES_JSON" | jq ". + [$VOLUME_ENTRY]")

            MOUNT_ENTRY=$(jq -n \
              --arg name "$VOL_NAME" \
              --arg target "$TARGET" \
              '{
                  name: $name,
                  mountPath: "/usr/src/app/files/credenciales/\($target)",
                  readOnly: true,
                  subPath: $target
              }')
            MOUNTS_JSON=$(echo "$MOUNTS_JSON" | jq ". + [$MOUNT_ENTRY]")

            COUNTER=$((COUNTER + 1))
          done < <(echo "$CREDENTIALS" | jq -c '.[]')
        fi

        yq eval ".spec.template.spec.volumes += $VOLUMES_JSON" "${BASETOP}/${KUSTOMIZER}-${SERVICIO}.yml" -i
        yq eval ".spec.template.spec.containers[0].volumeMounts += $MOUNTS_JSON" "${BASETOP}/${KUSTOMIZER}-${SERVICIO}.yml" -i

        echo "gcloud run services replace ${BASETOP}/${KUSTOMIZER}-${SERVICIO}.yml --region europe-west1${CLOUDSQL}" >> "${BASETOP}/lambda.sh"
        cat "${BASETOP}/${KUSTOMIZER}-${SERVICIO}.yml"
#        cat "${BASETOP}/lambda.sh"
#        echo "gcloud run deploy ${SERVICIO} --image europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${SERVICIO}:${VERSION}  --region europe-west1  --platform managed  --allow-unauthenticated" >> "${BASETOP}/lambda.sh"
      fi
    done
  }
  export -f parseWorkspace

  lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" || exit 1 &
  PID1=$!
  lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" || exit 1 &
  PID2=$!

  wait $PID1
  STATUS1=$?
  wait $PID2
  STATUS2=$?

  if [[ $STATUS1 -ne 0 || $STATUS2 -ne 0 ]]; then
    echo "Error ejecutando kustomize"
    exit 1
  fi
else
    echo "Omitiendo kustomización"
fi
