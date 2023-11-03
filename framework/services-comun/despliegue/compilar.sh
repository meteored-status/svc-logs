#!/bin/bash
########################
##### INICIAR MYSQL ####
########################
set -e

ENTORNO=${1}

if [[ -n "$MYSQL" ]]; then
  echo "Iniciando MySQL"
  ./cloud_sql_proxy -dir=/workspace -instances="${MYSQL}" &
  PID=$!
  sleep 2
  echo "${MYSQL}" > /workspace/mysql.txt
  echo "Iniciando MySQL => OK"
fi

echo "Compilando"
docker run -v /workspace:/root -e "ENV=${ENTORNO}" node:lts-alpine yarn --cwd /root mrpack deploy --env="${ENTORNO}"
echo "Compilando => OK"

if [[ -n "$MYSQL" ]]; then
  echo "Parando MySQL"
  kill -9 $PID
  sleep 2
  rm "/workspace/${MYSQL}"
  echo "Parando MySQL => OK"
fi
