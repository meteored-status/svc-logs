#!/bin/bash
########################
##### INICIAR MYSQL ####
########################
set -e

source @mr/cli/deployment/std/aliases.sh

# Sin generar no hay nada que compilar: lo único que hace falta es la versión desplegada de cada
# workspace (`version.txt` y `hash.txt`), y la escribe `mantener-version` (bin/) a partir de lo que deja
# «Obtener Tags». Antes se arrancaba `mrpack deploy` para eso, y por eso había que instalar antes todas
# las dependencias; ahora «Instalar Dependencias» también se las salta (ver instalar.sh). Solo los
# workspaces de `lw`, que son los únicos que generan contenedor y se kustomizan.
GENERAR=$(opcion --valor generar)
if [[ "${GENERAR}" == "false" ]]; then
  echo "Sin generar: se mantiene la versión desplegada"
  for GRUPO in cronjobs services jobs; do
    LISTA=$(lw "${GRUPO}")
    while read -r RUTA; do
      if [[ -n "${RUTA}" ]]; then
        mantener-version "${RUTA}"
      fi
    done <<< "${LISTA}"
  done
  exit 0
fi

if [[ -n "$_MYSQL" ]]; then
  echo "Iniciando MySQL"
  cloud_sql_proxy --unix-socket /workspace ${_MYSQL} --private-ip &
  PID=$!
  sleep 2
  echo "${_MYSQL}" > /workspace/mysql.txt
  echo "Iniciando MySQL => OK"
fi

# `mrpack` lee las opciones de sus variables de entorno (`applyENV()` del manifest raíz), y las del
# paso no entran en el contenedor si no se le pasan. Antes le llegaban por el `.env` que escribía
# «Descargas» y que `mrpack` carga con `dotenv/config`; ese fichero ya no existe. Se le pasan ya
# resueltas, con la misma regla que el resto del pipeline (bin/opcion). Aquí `_GENERAR` siempre es
# `true`: sin generar, el script ha terminado arriba.
GENERAR_FORZAR=$(opcion --valor generar-forzar)

echo "Compilando"
docker run -v /workspace:/root -e "ENV=${_ENTORNO}" -e "MRPACK_NODE_VERSION=$(versionNode)" -e "_GENERAR=${GENERAR}" -e "_GENERAR_FORZAR=${GENERAR_FORZAR}" "$(imagenNode)" sh -c "npm install -g corepack && corepack enable && cd /root && corepack install && yarn --cwd /root mrpack deploy --env=\"${_ENTORNO}\""
echo "Compilando => OK"

if [[ -n "$_MYSQL" ]]; then
  echo "Parando MySQL"
  kill -9 "${PID}"
  sleep 2
  rm -rf "/workspace/${_MYSQL}"
  echo "Parando MySQL => OK"
fi
