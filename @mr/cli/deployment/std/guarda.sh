#!/bin/bash
#
# Guarda contra builds concurrentes del mismo trigger.
#
# Cloud Build no serializa los builds de un trigger: dos pushes seguidos, un webhook que llega tarde
# o una ejecución a mano mientras corre otra dejan dos builds a la vez. Cada uno publica las mismas
# etiquetas (`latest`, `<ENTORNO>`…) y despliega, y si el más antiguo termina después, **deja en
# producción lo que desplegó él**.
#
# Este paso va el primero, y la regla es que gana el último build creado (un push, o una
# reejecución a mano de un commit viejo para volver atrás). Para cada build anterior del mismo
# trigger que siga en marcha:
#
# - Si todavía no ha hecho nada —está en `QUEUED`, o solo ha empezado su propio paso `Guarda`—, lo
#   **cancela**: ya está superado y cancelarlo no deja nada a medias.
# - Si ya ha pasado de la guarda, lo **espera**: cancelarlo a medias podría dejar la IP de su worker
#   en las redes autorizadas del cluster (`autorizar.sh` la quita en «Desautorizar», que no llegaría
#   a correr) o un despliegue a medias entre clusters.
#
# La espera tiene un tope (`_GUARDA_ESPERA_MAX`, 900 s por defecto). Al agotarlo, el build falla
# aquí, que es donde fallar no tiene efectos secundarios, y no a mitad de despliegue por el
# `timeout` del build, que cuenta también el tiempo de espera.
#
# No salta los builds repetidos del mismo commit: volver a lanzar un build es la forma de
# redesplegar, por ejemplo, tras cambiar una credencial.
#
# Si la primera consulta a Cloud Build falla (permisos, API), avisa y deja seguir: una guarda rota
# no debe parar todos los despliegues. Ya dentro de la espera, un fallo se reintenta y, si persiste,
# el build falla: seguir dejaría dos builds a la vez. La cuenta del build necesita
# `cloudbuild.builds.get`, `list` y `update` (cancelar).
#
# Necesita `BUILD_ID`, `LOCATION` y `PROJECT_ID`, que `build.yaml` le pasa en `env`.

SONDEO=20
ESPERA_MAX="${_GUARDA_ESPERA_MAX:-900}"
REINTENTOS=4

# stderr va a un fichero aparte y no se mezcla con la salida: cuando no hay resultados, `gcloud`
# escribe un `WARNING` por stderr («filter keys were not present in any resource»), y mezclado se
# tomaba por un build en marcha y la guarda esperaba para siempre.
ERRORES=$(mktemp)
trap 'rm -f "${ERRORES}"' EXIT

if [[ -z "${BUILD_ID}" || -z "${LOCATION}" || -z "${PROJECT_ID}" ]]; then
  echo "Guarda: AVISO, falta BUILD_ID, LOCATION o PROJECT_ID; se omite la guarda"
  exit 0
fi

PROPIO=$(gcloud builds describe "${BUILD_ID}" --project="${PROJECT_ID}" --region="${LOCATION}" --format="value(buildTriggerId,createTime)" 2>"${ERRORES}")
if [[ $? -ne 0 ]]; then
  echo "Guarda: AVISO, no se puede consultar este build; se omite la guarda: $(cat "${ERRORES}")"
  exit 0
fi
TRIGGER=$(echo "${PROPIO}" | cut -f1)
CREADO=$(echo "${PROPIO}" | cut -f2)

if [[ -z "${TRIGGER}" ]]; then
  echo "Guarda: build lanzado sin trigger; no hay builds hermanos que esperar"
  exit 0
fi

echo "Guarda: trigger ${TRIGGER}, creado ${CREADO}, espera máxima ${ESPERA_MAX} s"

# Los builds del mismo trigger, creados antes que este, que siguen en QUEUED o WORKING. Una línea
# por build: id, estado y commit corto.
listarAnteriores() {
  gcloud builds list --project="${PROJECT_ID}" --region="${LOCATION}" --ongoing \
    --filter="buildTriggerId=\"${TRIGGER}\" AND createTime<\"${CREADO}\"" \
    --format="value(id,status,substitutions.SHORT_SHA)" 2>"${ERRORES}"
}

# Éxito si el build todavía no ha hecho nada: está en QUEUED, o el único paso que ha empezado es su
# propio `Guarda` (el primero). Si no se puede consultar, se trata como empezado: se espera.
sinEmpezar() {
  local ID="${1}"
  local DATOS
  DATOS=$(gcloud builds describe "${ID}" --project="${PROJECT_ID}" --region="${LOCATION}" \
    --format="value(status,steps[].id.list(separator=';'),steps[].status.list(separator=';'))" 2>"${ERRORES}") || return 1
  local ESTADO IDS ESTADOS
  ESTADO=$(echo "${DATOS}" | cut -f1)
  IDS=$(echo "${DATOS}" | cut -f2)
  ESTADOS=$(echo "${DATOS}" | cut -f3)
  if [[ "${ESTADO}" == "QUEUED" ]]; then
    return 0
  fi
  if [[ "${IDS}" != Guarda* ]]; then
    return 1
  fi
  local LISTA_IDS LISTA_ESTADOS i
  IFS=';' read -ra LISTA_IDS <<< "${IDS}"
  IFS=';' read -ra LISTA_ESTADOS <<< "${ESTADOS}"
  for i in "${!LISTA_IDS[@]}"; do
    if [[ "${LISTA_IDS[$i]}" == "Guarda" ]]; then
      continue
    fi
    case "${LISTA_ESTADOS[$i]:-}" in
      ""|QUEUED|STATUS_UNKNOWN) ;;
      *) return 1 ;;
    esac
  done
  return 0
}

INICIO=$(date +%s)
ESPERADO=false
FALLOS=0
while true; do
  ANTERIORES=$(listarAnteriores)
  if [[ $? -ne 0 ]]; then
    FALLOS=$((FALLOS + 1))
    if [[ ${FALLOS} -ge ${REINTENTOS} ]]; then
      echo "Guarda: ERROR, no se pueden listar los builds tras ${FALLOS} intentos; se para para no desplegar a la vez que otro: $(cat "${ERRORES}")"
      exit 1
    fi
    echo "Guarda: no se pueden listar los builds (intento ${FALLOS} de ${REINTENTOS}); se reintenta"
    sleep 5
    continue
  fi
  FALLOS=0

  if [[ -z "${ANTERIORES}" ]]; then
    if [[ ${ESPERADO} == "true" ]]; then
      echo "Guarda: los builds anteriores han terminado tras $(( $(date +%s) - INICIO )) s; se sigue"
    else
      echo "Guarda: no hay builds anteriores en marcha"
    fi
    exit 0
  fi

  QUEDAN=""
  while IFS=$'\t' read -r ID ESTADO SHA; do
    if [[ -z "${ID}" ]]; then
      continue
    fi
    if sinEmpezar "${ID}"; then
      echo "Guarda: se cancela ${ID} (${SHA}, ${ESTADO}): es anterior y no ha empezado, así que este lo supera"
      if gcloud builds cancel "${ID}" --project="${PROJECT_ID}" --region="${LOCATION}" >/dev/null 2>"${ERRORES}"; then
        continue
      fi
      echo "Guarda: no se pudo cancelar ${ID}; se espera: $(cat "${ERRORES}")"
    fi
    QUEDAN="${QUEDAN}  ${ID} ${SHA} ${ESTADO}"$'\n'
  done <<< "${ANTERIORES}"

  if [[ -z "${QUEDAN}" ]]; then
    ESPERADO=true
    sleep 5
    continue
  fi

  TRANSCURRIDO=$(( $(date +%s) - INICIO ))
  if [[ ${TRANSCURRIDO} -ge ${ESPERA_MAX} ]]; then
    echo "Guarda: ERROR, tras ${TRANSCURRIDO} s siguen en marcha builds anteriores del mismo trigger:"
    printf '%s' "${QUEDAN}"
    echo "Guarda: se para aquí, sin haber hecho nada, para no desplegar a la vez que ellos. Si uno está colgado, cancélalo a mano y relanza este."
    exit 1
  fi

  echo "Guarda: esperando a builds anteriores del mismo trigger que ya están trabajando (${TRANSCURRIDO} s de ${ESPERA_MAX}):"
  printf '%s' "${QUEDAN}"
  ESPERADO=true
  sleep "${SONDEO}"
done
