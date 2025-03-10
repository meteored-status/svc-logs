#!/bin/bash
########################
##### INICIAR MYSQL ####
########################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -n "$_MYSQL" ]]; then
  echo "Iniciando MySQL"
  cloud_sql_proxy -dir=/workspace -instances="${_MYSQL}" &
  PID=$!
  sleep 2
  echo "${_MYSQL}" > /workspace/mysql.txt
  echo "Iniciando MySQL => OK"
fi

echo "Compilando"
docker run -v /workspace:/root -e "ENV=${_ENTORNO}" node:lts-alpine yarn --cwd /root mrpack deploy --env="${_ENTORNO}"
echo "Compilando => OK"

if [[ -n "$_MYSQL" ]]; then
  echo "Parando MySQL"
  kill -9 "${PID}"
  sleep 2
  rm "/workspace/${_MYSQL}"
  echo "Parando MySQL => OK"
fi
