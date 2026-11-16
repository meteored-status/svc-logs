#!/bin/bash
###############################
#### GENERAR DOCUMENTACIÓN ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

PID=""

# Instancia de Cloud SQL con la base `doc`. Solo `_MYSQL_DOC`, a propósito: generar la documentación es una decisión
# explícita de cada trigger, y la `_MYSQL` de los servicios no se usa aunque exista. Sin ella el paso no hace nada.
SOCKET="${_MYSQL_DOC}"
if [[ -z "${SOCKET}" ]]; then
  echo "Sin _MYSQL_DOC en el trigger: no se genera documentación"
fi

# Limpieza al salir, también si algo falla con `set -e`: sin esto, un error dejaba el proxy vivo y el socket
# en /workspace.
limpiar() {
  if [[ -n "${PID}" ]]; then
    echo "Parando MySQL"
    kill "${PID}" 2>/dev/null || true
    wait "${PID}" 2>/dev/null || true
    rm -rf "/workspace/${SOCKET}"
    echo "Parando MySQL => OK"
  fi
}
trap limpiar EXIT

if [[ -n "${SOCKET}" ]]; then
  echo "Iniciando MySQL"
  cloud_sql_proxy --unix-socket /workspace "${SOCKET}" --private-ip &
  PID=$!

  # Espera activa a que el proxy cree el socket (en vez de un `sleep` fijo, que era una carrera).
  for _ in $(seq 1 30); do
    if [[ -S "/workspace/${SOCKET}" ]]; then
      break
    fi
    if ! kill -0 "${PID}" 2>/dev/null; then
      echo "El proxy de MySQL ha terminado antes de tiempo" >&2
      exit 1
    fi
    sleep 1
  done
  if [[ ! -S "/workspace/${SOCKET}" ]]; then
    echo "Timeout esperando al socket de MySQL (/workspace/${SOCKET})" >&2
    exit 1
  fi
  echo "Iniciando MySQL => OK"

  echo "Generando documentación"
  # Con `set -e` un código de salida distinto de 0 de docker aborta el script (tras la limpieza del `trap`) y
  # lo propaga como código de salida del paso.
  docker run -v /workspace:/root -e "ENV=${_ENTORNO}" -e REPO_FULL_NAME -e COMMIT_SHA -e "MYSQL_SOCKET=/root/${SOCKET}" "$(imagenNode)" sh -c "npm install -g corepack && corepack enable && cd /root && corepack install && yarn --cwd /root mrpack autodoc --env=\"${_ENTORNO}\""
  echo "Generando documentación => OK"
fi
