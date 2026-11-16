#!/bin/bash
##############################
##### CLONAR REPOSITORIOS ####
##############################
set -euo pipefail

source @mr/cli/deployment/std/aliases.sh

# La organización de GitHub sale de `_K8S_GITHUB` si el trigger la define; si no, de la etiqueta
# `k8s-github` del proyecto. Se lee con `gcloud` (`etiquetaProyecto()` en aliases.sh) y no de
# `labels.json`, para no esperar a «Labels»: este paso y «Iniciar Kustomize» corren en paralelo con él.
companies() {
  if [[ -n "${_K8S_GITHUB:-}" ]]; then
    echo "${_K8S_GITHUB}"
  else
    etiquetaProyecto k8s-github
  fi
}

if opcion desplegar; then
  # Un PAT fine-grained solo vale para una organización de GitHub. Si el kustomize es de otra, su
  # token se lee del secreto `alpred-lectura` del proyecto de GCP de esa organización; la cuenta de
  # Cloud Build necesita ahí `roles/secretmanager.secretAccessor`. Va por trigger (solo la
  # sustitución, sin etiqueta de proyecto): en un mismo proyecto hay despliegues que usan su propio
  # kustomize y otros que usan el de otra organización.
  PROYECTO_TOKEN="${_K8S_GITHUB_PROYECTO:-}"
  if [[ -n "${PROYECTO_TOKEN}" && "${PROYECTO_TOKEN}" != "${PROJECT_ID}" ]]; then
    echo "Leyendo el token de GitHub del proyecto ${PROYECTO_TOKEN}"
    GITTOKEN="$(gcloud secrets versions access latest --secret=alpred-lectura --project="${PROYECTO_TOKEN}")"
    export GITTOKEN
  fi

  parseRepository() {
    local COMPANY="${1}"
    # Sin espacios ni saltos de línea que se cuelen al guardar el secreto.
    local TOKEN="${GITTOKEN//[$'\t\r\n ']/}"

    # El token va como contraseña: los PAT fine-grained (`github_pat_…`) no autentican si van como
    # usuario, que es como funcionaban los clásicos (`ghp_…`). `x-access-token` vale para los dos.
    # Va en una cabecera y no en la URL: con credenciales en la URL git avisa de una redirección que
    # no existe, y el token se quedaría guardado en `kustomizar/.git/config`.
    local AUTH
    AUTH="$(printf 'x-access-token:%s' "${TOKEN}" | base64 | tr -d '\n')"

    # Producción, la rama por defecto del repo (`main`); el resto, `develop`.
    local RAMA=""
    if [[ ${_ENTORNO} != "produccion" ]]; then
      RAMA="develop"
    fi

    echo "Clonando repositorio ${COMPANY}/kustomize.git${RAMA:+ (rama ${RAMA})}"
    GIT_TERMINAL_PROMPT=0 git -c "http.https://github.com/.extraheader=Authorization: Basic ${AUTH}" clone ${RAMA:+--branch "${RAMA}"} "https://github.com/${COMPANY}/kustomize.git" kustomizar
  }
  export -f parseRepository

  # En una asignación para que, si `gcloud` falla, falle el paso (con `set -e`); antes, sin la
  # etiqueta, se intentaba clonar `null/kustomize`.
  COMPANIES=$(companies)
  if [[ -z "${COMPANIES}" ]]; then
    echo "ERROR: no hay organización de GitHub para el kustomize (ni _K8S_GITHUB ni la etiqueta k8s-github del proyecto)"
    exit 1
  fi
  echo "${COMPANIES}" | xargs -I '{}' -P10 -n1 bash -c "parseRepository {}"
else
    echo "Omitiendo clonado de kustomizer"
fi
