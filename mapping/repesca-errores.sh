#!/usr/bin/env bash

cd "$(dirname "$0")" || exit
mkdir -p repesca
cd repesca || exit

parseStorage() {
  BUCKET=${1}

  parseStorageDate() {
    BUCKET=${1}
    DATE=${2}

    gsutil -m mv "gs://${BUCKET}/${DATE}" ./
#    gsutil -q ls -L "gs://${BUCKET}/${DATE}"
#    status=$?
#    if [[ $status == 0 ]]; then
#      echo "gs://${BUCKET}/${DATE}"
#      gsutil -m mv "gs://${BUCKET}/${DATE}" ./
#    fi
  }

  parseStorageDate "${BUCKET}" "20230622"
  parseStorageDate "${BUCKET}" "20230623"
  parseStorageDate "${BUCKET}" "20230624"
  parseStorageDate "${BUCKET}" "20230625"
  parseStorageDate "${BUCKET}" "20230626"
  parseStorageDate "${BUCKET}" "20230627"
  parseStorageDate "${BUCKET}" "20230628"

  if [ "$(ls -A .)" ]; then
    gsutil -m mv ./* "gs://${BUCKET}/"
    rm -R *
  fi
}

parseStorage "mr-cf-logs-ed"
parseStorage "mr-cf-logs-fce"
parseStorage "mr-cf-logs-hoteles"
parseStorage "mr-cf-logs-meteored"
parseStorage "mr-cf-logs-motor"
parseStorage "mr-cf-logs-tiempo-ar"
parseStorage "mr-cf-logs-tiempo-at"
parseStorage "mr-cf-logs-tiempo-bo"
parseStorage "mr-cf-logs-tiempo-br"
parseStorage "mr-cf-logs-tiempo-ca"
parseStorage "mr-cf-logs-tiempo-cl"
parseStorage "mr-cf-logs-tiempo-cr"
parseStorage "mr-cf-logs-tiempo-de"
parseStorage "mr-cf-logs-tiempo-do"
parseStorage "mr-cf-logs-tiempo-ec"
parseStorage "mr-cf-logs-tiempo-en"
parseStorage "mr-cf-logs-tiempo-es"
parseStorage "mr-cf-logs-tiempo-eu"
parseStorage "mr-cf-logs-tiempo-fr"
parseStorage "mr-cf-logs-tiempo-hn"
parseStorage "mr-cf-logs-tiempo-it"
parseStorage "mr-cf-logs-tiempo-mx"
parseStorage "mr-cf-logs-tiempo-nl"
parseStorage "mr-cf-logs-tiempo-pa"
parseStorage "mr-cf-logs-tiempo-pe"
parseStorage "mr-cf-logs-tiempo-pt"
parseStorage "mr-cf-logs-tiempo-py"
parseStorage "mr-cf-logs-tiempo-ru"
parseStorage "mr-cf-logs-tiempo-uy"
parseStorage "mr-cf-logs-tiempo-ve"
