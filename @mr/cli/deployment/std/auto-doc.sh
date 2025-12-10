#!/bin/bash
###############################
#### GENERAR DOCUMENTACIÓN ####
###############################
set -e

source @mr/cli/deployment/std/aliases.sh

if [[ -n "$_MYSQL" ]]; then
  echo "Iniciando MySQL"
  cloud_sql_proxy --unix-socket /workspace ${_MYSQL} --private-ip &
  PID=$!
  sleep 2
  echo "${_MYSQL}" > /workspace/mysql.txt
  echo "Iniciando MySQL => OK"
fi

if [[ -n "$_MYSQL" ]]; then
  echo "Generando documentación"
  docker run -v /workspace:/root -e "ENV=${_ENTORNO}" node:lts-alpine yarn --cwd /root mrpack autodoc --env="${_ENTORNO}"
  echo "Generando documentación => OK"
fi

if [[ -n "$_MYSQL" ]]; then
  echo "Parando MySQL"
  kill -9 "${PID}"
  sleep 2
  rm -rf "/workspace/${_MYSQL}"
  echo "Parando MySQL => OK"
fi
