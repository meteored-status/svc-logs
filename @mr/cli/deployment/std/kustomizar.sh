#!/bin/bash
###############################
#### INICIALIZAR KUSTOMIZE ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

BASETOP=$(pwd)

export BASETOP
export PROJECT_ID

if [[ -f "DESPLEGAR.txt" ]]; then
  # Deja en `REGISTRO`, `PAQUETE` y `NOMBRE` dónde ha subido `contenedor.sh` la imagen del workspace de
  # `RUTA`, a partir de `deploy.imagen.<entorno>` y con sus mismos valores por defecto. Si no coinciden, el
  # despliegue apunta a una imagen que no existe.
  imagenSubida() {
    RUTA="${1}"
    WORKSPACE="${2}"

    REGISTRO=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .registro // empty")
    if [[ -z "${REGISTRO}" || "${REGISTRO}" == "null" ]]; then
      REGISTRO="europe-west1-docker.pkg.dev"
    fi
    PAQUETE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .paquete // empty")
    if [[ -z "${PAQUETE}" || "${PAQUETE}" == "null" ]]; then
      PAQUETE="services"
    fi
    NOMBRE=$(configw "${RUTA}" ".deploy.imagen.${_ENTORNO}? // empty | .nombre // empty")
    if [[ -z "${NOMBRE}" || "${NOMBRE}" == "null" ]]; then
      NOMBRE="${WORKSPACE}"
    fi
  }
  export -f imagenSubida

  updateImagen() {
    KUSTOMIZER="${1}"
    DIR="${2}"
    WORKSPACE="${3}"
    VERSION="${4}"

    # La parte de antes del `=` es el nombre con el que referencian la imagen los manifiestos del repo de
    # kustomize, y por eso no cambia; la de después, la que se ha subido de verdad.
    imagenSubida "${RUTA}" "${WORKSPACE}"
    IMAGEN="${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}:${VERSION}"

    cd "${DIR}"
    kustomize edit set image "europe-west1-docker.pkg.dev/${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}=${IMAGEN}"
    kustomize edit set image "europe-west1-docker.pkg.dev/\\\${PROJECT_ID}/${KUSTOMIZER}/${WORKSPACE}=${IMAGEN}"
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

  # Deja en `FICHERO` solo los recursos cuyo namespace existe en el cluster de `CLUSTER` (su zona), según
  # `namespaces_all_<zona>.json` de `labels.sh`, y avisa de los namespaces descartados. Los recursos sin
  # namespace se quedan. Falla solo si no hay listado para esa zona.
  filtrarNamespaces() {
    FICHERO="${1}"
    CLUSTER="${2}"
    DISPONIBLES="namespaces_all_${CLUSTER}.json"

    if [[ ! -f "${DISPONIBLES}" ]]; then
      echo "No hay listado de namespaces para \"${CLUSTER}\" (${DISPONIBLES})"
      return 1
    fi

    DISPONIBLES_JSON="$(cat "${DISPONIBLES}")"
    export DISPONIBLES_JSON

    FALTAN=$(yq eval -N 'select(.metadata.namespace != null and ([.metadata.namespace] - env(DISPONIBLES_JSON) | length > 0)) | .metadata.namespace' "${FICHERO}" | sort -u | paste -sd ',' - | sed 's/,/, /g')
    if [[ -n "${FALTAN}" ]]; then
      echo "Se descartan los recursos de namespaces que no existen en \"${CLUSTER}\": ${FALTAN}"
      yq eval -i 'select(.metadata.namespace == null or ([.metadata.namespace] - env(DISPONIBLES_JSON) | length == 0))' "${FICHERO}"
    fi
  }
  export -f filtrarNamespaces

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
      CLIENTE="${7:-*}"

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

      ARCH=$(configw "${RUTA}" '.deploy.arch // empty | select(type == "array") | join(",")')
      if [[ -z "$ARCH" || "$ARCH" == "" ]]; then
        ARCH="linux/amd64"
      fi

      GENERADO="generado_${WORKSPACE}_${CLUSTER}.yaml"
      bash "kustomizar/build.sh" "${PROJECT_ID}" "${KUSTOMIZER}" "${SERVICIO}" "${ENTORNO}" "${CLUSTER}" "${VERSION}" "${CLIENTE}" "${ARCH}" > "${GENERADO}" || exit 1
      filtrarNamespaces "${GENERADO}" "${CLUSTER}" || exit 1
      cat "${GENERADO}" >> "despliegue_${WORKSPACE}_${CLUSTER}.yaml"
      rm "${GENERADO}"
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

  parseWorkspaceLambdaZona() {
    RUTA="${1}"
    REGION="${2}"
    ZONA="${3}"

    if [[ "$(configw "${RUTA}" '.deploy.type')" == "service" ]]; then
      COMANDO="services"
      TYPE="service"
      SUBTYPE=""
    elif [[ "$(configw "${RUTA}" '.deploy.type')" == "cronjob" ]]; then
      COMANDO="jobs"
      TYPE="job"
      SUBTYPE="cronjob"
    else
      COMANDO="jobs"
      TYPE="job"
      SUBTYPE="job"
    fi

    LAMBDA_SCRIPT="${BASETOP}/lambda-${ZONA}.sh"
    CLOUD_RUN_YAML="${BASETOP}/${KUSTOMIZER}-${SERVICIO}-${ZONA}.yml"

    if [[ ! -f "${LAMBDA_SCRIPT}" ]]; then
      echo "#!/bin/bash" > "${LAMBDA_SCRIPT}"
      echo "set -e" >> "${LAMBDA_SCRIPT}"
      echo "" >> "${LAMBDA_SCRIPT}"
    fi

    # La imagen es la que ha subido `contenedor.sh`; el nombre del servicio o job sigue saliendo de
    # `deploy.kustomize` (`${KUSTOMIZER}-${IMAGEN}`).
    imagenSubida "${RUTA}" "${WORKSPACE}"

    cat "${BASETOP}/@mr/cli/deployment/std/cloud-run-${TYPE}.yml" \
      | sed "s#\${REGISTRO}#${REGISTRO}#g" \
      | sed "s#\${PAQUETE}#${PAQUETE}#g" \
      | sed "s#\${NOMBRE}#${NOMBRE}#g" \
      | sed "s/\${PROJECT_ID}/${PROJECT_ID}/g" \
      | sed "s/\${KUSTOMIZER}/${KUSTOMIZER}/g" \
      | sed "s/\${IMAGEN}/${SERVICIO}/g" \
      | sed "s/\${VERSION}/${VERSION}/g" \
      | sed "s/\${ENTORNO}/${_ENTORNO}/g" \
      | sed "s/\${ZONA}/${ZONA}/g" \
      | sed "s/\${REGION}/${REGION}/g" \
      > "${CLOUD_RUN_YAML}"
    CLOUDSQL=$(configw "${RUTA}" ".deploy.cloudsql.${_ENTORNO} // empty | if type==\"array\" and length > 0 then join(\",\") else empty end")
    if [[ -n "${CLOUDSQL}" ]]; then
      yq eval ".spec.template.metadata.annotations.\"run.googleapis.com/cloudsql-instances\" = \"${CLOUDSQL}\"" "${CLOUD_RUN_YAML}" -i
    fi

    # Comprobar que exista la entrada deploy.lambda.egress
    LAMBDA=$(configw "${RUTA}" '.deploy.lambda // empty')
    if [[ -n "${LAMBDA}" ]]; then
      VPC=$(configw "${RUTA}" '.deploy.lambda.vpc // empty')

      if [[ "${VPC}" == "true" ]]; then
        EGRESS=$(configw "${RUTA}" '.deploy.lambda.egress // "private-ranges-only"')
        VPC_ACCESS_EGRESS=$(printf '%s' "${EGRESS}" | jq -Rr @json)
        yq eval ".spec.template.metadata.annotations.\"run.googleapis.com/vpc-access-egress\" = ${VPC_ACCESS_EGRESS}" "${CLOUD_RUN_YAML}" -i

        NETWORK=$(configl ".labels[\"network\"] // empty")
        if [[ -n "${NETWORK}" ]]; then
          SUBNETWORK=$(configl ".labels[\"subnetwork\"] // empty")
          if [[ -n "${SUBNETWORK}" ]]; then
            NETWORK_INTERFACES=$(jq -cn --arg network "${NETWORK}" --arg subnetwork "${SUBNETWORK}" '[{network: $network, subnetwork: $subnetwork}]' | jq -Rr @json)
            yq eval ".spec.template.metadata.annotations.\"run.googleapis.com/network-interfaces\" = ${NETWORK_INTERFACES}" "${CLOUD_RUN_YAML}" -i
          fi
        fi
      fi

      if [[ "${TYPE}" == "service" ]]; then
        INGRESS=$(configw "${RUTA}" '.deploy.lambda.ingress // "internal-and-cloud-load-balancing"')
        CLOUD_RUN_INGRESS=$(printf '%s' "${INGRESS}" | jq -Rr @json)
        yq eval ".metadata.annotations.\"run.googleapis.com/ingress\" = ${CLOUD_RUN_INGRESS}" "${CLOUD_RUN_YAML}" -i
      fi
    fi

    # Comprobar que exista la entrada deploy.annotations
    ANNOTATIONS=$(configw "${RUTA}" '.deploy.annotations // empty')
    if [[ -n "${ANNOTATIONS}" ]]; then
      # Comprobar si existe la entrada deploy.annotations.service
      SERVICE_ANNOTATIONS=$(configw  "${RUTA}" '.deploy.annotations.service // empty')
      if [[ -n "${SERVICE_ANNOTATIONS}" ]]; then
        for KEY in $(echo "${SERVICE_ANNOTATIONS}" | jq -r 'keys[]'); do
          VALUE=$(echo "${SERVICE_ANNOTATIONS}" | jq -r --arg key "${KEY}" '.[$key]')
          yq eval ".metadata.annotations.\"${KEY}\" = \"${VALUE}\"" "${CLOUD_RUN_YAML}" -i
        done
      fi
    fi

    # Comprobar que exista la entrada deploy.env
    ENV_VARS=$(configw "${RUTA}" '.deploy.env // empty')
    if [[ -n "${ENV_VARS}" ]]; then
      ENV_JSON='[]'
      for KEY in $(echo "${ENV_VARS}" | jq -r 'keys[]'); do
        VALUE=$(echo "${ENV_VARS}" | jq -r --arg key "${KEY}" '.[$key]')
        ENV_ENTRY=$(jq -n --arg name "${KEY}" --arg value "${VALUE}" '{name: $name, value: $value}')
        ENV_JSON=$(echo "${ENV_JSON}" | jq ". + [${ENV_ENTRY}]")
      done

      if [[ "${TYPE}" == "service" ]]; then
        yq eval ".spec.template.spec.containers[0].env += ${ENV_JSON}" "${CLOUD_RUN_YAML}" -i
      else
        yq eval ".spec.template.spec.template.spec.containers[0].env += ${ENV_JSON}" "${CLOUD_RUN_YAML}" -i
      fi
    fi

    VOLUMES_JSON='[]'
    MOUNTS_JSON='[]'
    CREDENTIALS=$(configw "${RUTA}" '.deploy.credenciales // []')
    if [[ "$CREDENTIALS" != "[]" ]]; then
      COUNTER=0

      # Cargamos todos los secretos disponibles
      SECRETS=$(gcloud secrets list --project="${PROJECT_ID}" --format="value(name)")
#      echo "Se han encontrado los siguientes secretos en el proyecto '${PROJECT_ID}':"
#      echo "$SECRETS"

      while IFS= read -r item; do
        [[ -z "$item" ]] && continue
        SOURCE=$(echo "$item" | jq -r '.source' | sed "s/\${ZONA}/${ZONA}/g" | sed "s/\${ENTORNO}/${_ENTORNO}/g")
        TARGET=$(echo "$item" | jq -r '.target' | sed "s/\${ZONA}/${ZONA}/g" | sed "s/\${ENTORNO}/${_ENTORNO}/g")

        # Comprobamos que el secreto existe
        if ! echo "$SECRETS" | grep -q "^${SOURCE}$"; then
          echo "Advertencia: El secreto '${SOURCE}' no existe en el proyecto '${PROJECT_ID}' y será omitido."
          continue
        fi

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
              mountPath: "/usr/src/app/files/.credenciales/\($target)",
              readOnly: true
          }')
        MOUNTS_JSON=$(echo "$MOUNTS_JSON" | jq ". + [$MOUNT_ENTRY]")

        COUNTER=$((COUNTER + 1))
      done <<< "$(echo "$CREDENTIALS" | jq -c '.[]')"
    fi

    if [[ "${TYPE}" == "service" ]]; then
      yq eval ".spec.template.spec.volumes += $VOLUMES_JSON" "${CLOUD_RUN_YAML}" -i
      yq eval ".spec.template.spec.containers[0].volumeMounts += $MOUNTS_JSON" "${CLOUD_RUN_YAML}" -i
    else
      yq eval ".spec.template.spec.template.spec.volumes += $VOLUMES_JSON" "${CLOUD_RUN_YAML}" -i
      yq eval ".spec.template.spec.template.spec.containers[0].volumeMounts += $MOUNTS_JSON" "${CLOUD_RUN_YAML}" -i
    fi

    echo "echo \"Desplegando lambda-${TYPE} ${KUSTOMIZER}-${SERVICIO}-${ZONA}\"" >> "${LAMBDA_SCRIPT}"
    echo "gcloud run ${COMANDO} replace ${CLOUD_RUN_YAML} --region ${REGION}" >> "${LAMBDA_SCRIPT}"
    if [[ "${SUBTYPE}" == "cronjob" ]]; then
      SCHEDULE=$(configw "${RUTA}" '.deploy.schedule // "0 0 31 2 *"')
      EXISTE=$(gcloud scheduler jobs describe "${KUSTOMIZER}-${SERVICIO}-${ZONA}-scheduler-trigger" --location=${REGION} --format="value(schedule)" 2>/dev/null)
      if [[ -z "$EXISTE" ]]; then
        echo "echo \"Creando programación para ${KUSTOMIZER}-${SERVICIO}-${ZONA} (${SCHEDULE})\"" >> "${LAMBDA_SCRIPT}"
        echo "gcloud scheduler jobs create http ${KUSTOMIZER}-${SERVICIO}-${ZONA}-scheduler-trigger \
          --location=${REGION} \
          --schedule=\"${SCHEDULE}\" \
          --time-zone=\"Etc/UTC\" \
          --uri=\"https://${REGION}-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/${PROJECT_ID}/jobs/${KUSTOMIZER}-${SERVICIO}:run\" \
          --http-method=POST \
          --oauth-service-account-email=scheduler-invoker@${PROJECT_ID}.iam.gserviceaccount.com \
          --headers=\"Content-Type=application/json,User-Agent=Google-Cloud-Scheduler\"" >> "${LAMBDA_SCRIPT}"
      elif [[ "$EXISTE" != "$SCHEDULE" ]]; then
        echo "echo \"Actualizando programación para ${KUSTOMIZER}-${SERVICIO}-${ZONA} (${SCHEDULE})\"" >> "${LAMBDA_SCRIPT}"
        echo "gcloud scheduler jobs update http ${KUSTOMIZER}-${SERVICIO}-${ZONA}-scheduler-trigger \
          --location=${REGION} \
          --schedule=\"${SCHEDULE}\" \
          --time-zone=\"Etc/UTC\"" >> "${LAMBDA_SCRIPT}"
      fi
    elif [[ "${SUBTYPE}" == "job" ]]; then
      EXISTE=$(gcloud scheduler jobs describe "${KUSTOMIZER}-${SERVICIO}-${ZONA}-scheduler-trigger" --location=${REGION} --format="value(schedule)" 2>/dev/null)
      if [[ -n "$EXISTE" ]]; then
        echo "echo \"Eliminando programación para ${KUSTOMIZER}-${SERVICIO}-${ZONA}\"" >> "${LAMBDA_SCRIPT}"
        echo "gcloud scheduler jobs delete ${KUSTOMIZER}-${SERVICIO}-${ZONA}-scheduler-trigger --location=${REGION} --quiet" >> "${LAMBDA_SCRIPT}"
      fi
    fi
#    cat "${CLOUD_RUN_YAML}"
#    echo "" > "${LAMBDA_SCRIPT}"
#    cat "${LAMBDA_SCRIPT}"
  }
  export -f parseWorkspaceLambdaZona

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

# .name
# .zone
# .resourceLabels.client-ids

      if [[ "$(configw "${RUTA}" '.deploy.target')" == "k8s" ]]; then
        NUM_CLIENTES=$(configc "length")
        if [[ "$NUM_CLIENTES" -eq 0 ]]; then
          ZONAS=$(confige '.[] | .resourceLabels.zona')
          for ZONA in ${ZONAS}; do
            parseWorkspaceCluster "${DIRECTORIO}" "${WORKSPACE}" "${SERVICIO}" "${VERSION}" "${KUSTOMIZER}" "${ZONA}"
            STATUS=$?
            if [[ $STATUS -ne 0 ]]; then
              echo "Error ejecutando kustomize para ${WORKSPACE} (${SERVICIO}) en ${ZONA}"
              exit 1
            fi
          done
        else
          CLUSTERES=$(configc '.[] | .name')
          for CLUSTER in ${CLUSTERES}; do
            ZONA=$(jq -r ".resourceLabels.zona" "${CLUSTER}.json")
            CLIENTES=$(jq -r ".resourceLabels.\"client-ids\"" "${CLUSTER}.json")
            IFS='_' read -r -a CLIENTES_ARRAY <<< "${CLIENTES}"
            for CLIENTE in "${CLIENTES_ARRAY[@]}"; do
              parseWorkspaceCluster "${DIRECTORIO}" "${WORKSPACE}" "${SERVICIO}" "${VERSION}" "${KUSTOMIZER}" "${ZONA}" "${CLIENTE}"
              STATUS=$?
              if [[ $STATUS -ne 0 ]]; then
                echo "Error ejecutando kustomize para ${WORKSPACE} (${SERVICIO}) en ${ZONA} [${CLIENTE}]"
                exit 1
              fi
            done
          done
        fi

      elif [[ "$(configw "${RUTA}" '.deploy.target')" == "lambda" ]]; then

        if [[ "$(configw "${RUTA}" '.deploy.type')" == "service" ]]; then
          COMANDO="services"
          TYPE="service"
          SUBTYPE=""
        elif [[ "$(configw "${RUTA}" '.deploy.type')" == "cronjob" ]]; then
          COMANDO="jobs"
          TYPE="job"
          SUBTYPE="cronjob"
        else
          COMANDO="jobs"
          TYPE="job"
          SUBTYPE="job"
        fi

        if [[ "$(configw "${RUTA}" '.deploy.alone')" == "true" ]]; then
          # Un unico despliegue: la region de Belgica (europe-west1) si el entorno tiene cluster alli, y
          # si no, el primero del array. Es el mismo criterio que ya sigue el despliegue GKE, donde los
          # workspaces `alone` van solo al cluster de indice 0 (ver `desplegar.sh`). Antes iban forzadas
          # region y zona, asi que un entorno sin cluster en europe-west1 generaba un `lambda-belgica.sh`
          # apuntando a una zona inexistente.
          CLUSTER_ALONE=$(confige '([.[] | select(.zone == "europe-west1")][0] // .[0] // {}) | [.zone // "", .resourceLabels.zona // ""] | @tsv')
          IFS=$'\t' read -r REGION ZONA <<< "${CLUSTER_ALONE}"
          if [[ -z "${REGION}" || -z "${ZONA}" ]]; then
            echo "No hay ningún cluster con zona en \"${_ENTORNO}\" para desplegar ${WORKSPACE} (${SERVICIO}) en solitario"
            exit 1
          fi
          parseWorkspaceLambdaZona "${RUTA}" "${REGION}" "${ZONA}"
        else
          REGIONES=$(confige '.[] | .zone')
          for REGION in ${REGIONES}; do
            ZONA=$(confige ".[] | select(.zone == \"${REGION}\") | .resourceLabels.zona")
            parseWorkspaceLambdaZona "${RUTA}" "${REGION}" "${ZONA}"
          done
        fi
      fi
    done
  }
  export -f parseWorkspace

  lw cronjobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" || exit 1 &
  PID1=$!
  lw services | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" || exit 1 &
  PID2=$!
  lw jobs | xargs -I '{}' -P 10 bash -c "parseWorkspace {}" || exit 1 &
  PID3=$!

  wait $PID1
  STATUS1=$?
  wait $PID2
  STATUS2=$?
  wait $PID3
  STATUS3=$?

  if [[ $STATUS1 -ne 0 || $STATUS2 -ne 0 || $STATUS3 -ne 0 ]]; then
    echo "Error ejecutando kustomize"
    exit 1
  fi
else
    echo "Omitiendo kustomización"
fi
