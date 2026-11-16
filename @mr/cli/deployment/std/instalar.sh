#!/bin/bash
#
# Paso «Instalar Dependencias»: `yarn install` del monorepo, con la versión de Node de
# `versionNode()` (aliases.sh). Va en un `docker run` y no como imagen del paso en `build.yaml`
# porque allí la imagen tiene que ser fija y aquí sale del `.node-version` del repo.
set -e

source @mr/cli/deployment/std/aliases.sh

# Las dependencias solo las usan `mrpack deploy` en «Compilar», que sin generar no corre (ver
# compilar.sh), y `mrpack autodoc` en «Generar Documentación», que solo corre con `_MYSQL_DOC` (no con
# `_MYSQL`: ver auto-doc.sh). Sin ninguno de los dos, instalarlas solo retrasaba «Compilar». `opcion`
# necesita el `jq` de «Descargas»: por eso este paso espera también a ese, que acaba a la vez que la
# descarga de la caché.
GENERAR=$(opcion --valor generar)
if [[ "${GENERAR}" == "false" && -z "${_MYSQL_DOC}" ]]; then
  echo "Omitiendo la instalación de dependencias: sin generar y sin _MYSQL_DOC no las usa nadie"
  exit 0
fi

# Sin `enableHardenedMode` (activo en el `.yarnrc.yml`): con él, cada instalación vuelve a comprobar
# todo el `yarn.lock` contra el registro de npm, y eso eran 10 de los ~22 s del paso aunque el lockfile
# no hubiera cambiado. Sigue activo en local, que es donde se crea el lockfile. Aquí se siguen
# comprobando los checksums de cada paquete contra el lockfile (`checksumBehavior: throw`), y
# `--immutable` hace fallar el build si el `yarn.lock` no cuadra con los `package.json` (dentro del
# `docker run` Yarn no detecta el CI y no lo activa solo).
IMAGEN=$(imagenNode)
echo "Instalando dependencias con ${IMAGEN}"
docker run -v /workspace:/root -e YARN_ENABLE_HARDENED_MODE=0 "${IMAGEN}" sh -c "npm install -g corepack && corepack enable && cd /root && corepack install && yarn install --immutable --mode=skip-build"
