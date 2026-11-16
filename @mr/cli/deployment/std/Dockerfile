# El pipeline siempre pasa BASE_IMAGE: la versión de Node del `.node-version` del monorepo (ver
# `versionNode()` en aliases.sh) o la base que fije el workspace. Este valor solo vale para builds a mano.
ARG BASE_IMAGE=node:lts-alpine

# Las tres etapas antes de `app` existen solo para resolver `node_modules` de producción: nada de lo
# que se hace en ellas acaba en la imagen salvo `.yarn`, `.pnp.*` y `yarn.lock`. Por eso **no copian
# código** y por eso no declaran los dos ARG de Datadog: `DD_GIT_COMMIT_SHA` cambia en cada commit, y
# un ARG declarado aquí arrastraría su valor a la clave de caché del install, que es justo la capa que
# interesa reutilizar entre despliegues. Detalle y medidas: «Caché del contenedor» y «Arquitecturas» en
# @mr/cli/deployment/README.md.

# El `package.json` del workspace **sin `version`**. El paso Compilar le escribe una versión nueva cada
# vez que se genera la imagen, y si entrara tal cual en las etapas de abajo la capa del install no se
# reutilizaría nunca: es lo que pasaba. Corre en la plataforma del builder, sin emulación.
FROM --platform=$BUILDPLATFORM ${BASE_IMAGE} AS manifiesto
ARG RUTA
ARG WS
COPY ./${RUTA}/${WS}/package.json /manifiesto/package.json
RUN node -e 'const f="/manifiesto/package.json"; const j=require(f); delete j.version; require("fs").writeFileSync(f, JSON.stringify(j, null, 2) + "\n");'

# Resolución, descarga y enlazado **en la plataforma del builder** pero para la arquitectura destino
# (`supportedArchitectures`, con `TARGETARCH`), y sin scripts de build, que sí dependen de la
# arquitectura. Es lo caro del install, y emulado (arm64 en un worker amd64) costaba trece veces más.
FROM --platform=$BUILDPLATFORM ${BASE_IMAGE} AS deps
ARG RUTA
ARG WS
ARG TARGETARCH
WORKDIR /usr/src/app
RUN npm install -g corepack && corepack enable
RUN mkdir ./.yarn && mkdir ./.yarn/unplugged
COPY ./.yarn/plugins ./.yarn/plugins
COPY ./.yarn/releases ./.yarn/releases
COPY ./.yarnrc.yml ./
COPY ./package.json ./yarn.lock ./
# La versión de Yarn la fija `packageManager` del `package.json` raíz, no `yarn@latest`: ver el
# comentario de `corepack install` en la etapa `app`.
RUN corepack install
# Solo el manifiesto del workspace, no el workspace entero. `focus --production` ignora las
# `devDependencies`, que es donde viven todas las dependencias entre workspaces (`services-comun`,
# `@mr/core-*`, `i18n`...), así que no hace falta que existan sus directorios — de hecho nunca se
# copiaron. Copiar el workspace completo invalidaba esta capa con cualquier cambio de código, y en
# un servicio Next.js metía además el `.next` entero en una etapa que lo tira a la basura.
COPY --from=manifiesto /manifiesto/package.json ./${RUTA}/${WS}/
ENV NODE_ENV=production
# El modo endurecido es `--check-resolutions --refresh-lockfile`: revalida contra el registro que
# cada resolución del lockfile corresponde a su rango. Es una comprobación de cadena de suministro
# que el pipeline **ya ha hecho** en el paso `Instalar Dependencias`, sobre este mismo lockfile y
# con el `.yarnrc.yml` del repo. Repetirla aquí, una vez por servicio, no descubre nada nuevo y
# cuesta una ronda de red por cada rango. Se desactiva por entorno para no tocar la configuración
# del repositorio, donde debe seguir activa.
ENV YARN_ENABLE_HARDENED_MODE=0
# **`.yarn/cache` no se puede montar aquí, y el motivo no es evidente.** Con `enableGlobalCache: false`
# no es una caché de descarga: es el almacén de paquetes en tiempo de ejecución. PnP resuelve cada
# paquete desde su `.zip` dentro de `.yarn/cache`, y los `COPY --from` de las etapas de abajo son lo que
# lo mete en la imagen. Montarla con `--mount=type=bind` deja los zips en el montaje, que se descarta al
# acabar la instrucción: la imagen sale con un `.pnp.cjs` que apunta a unos zips que no existen y el
# contenedor muere al arrancar con «Required package missing from disk». Se probó, y es lo que pasó.
# Para saltarse la descarga de npm está la caché de capas del registro, que reutiliza esta capa entera
# —zips incluidos— mientras no cambien `yarn.lock` ni el `package.json` del workspace.
#
# `supportedArchitectures` va en el `.yarnrc.yml` solo durante el install (`yarn workspaces focus` no
# admite `--mode=skip-build`, por eso los scripts se apagan con `YARN_ENABLE_SCRIPTS`), y se deja como
# estaba: es el que llega a la imagen. Los nombres de CPU son los de Node (`x64`), no los de Docker.
RUN CPU="$([ "$TARGETARCH" = amd64 ] && echo x64 || echo "$TARGETARCH")" \
 && cp .yarnrc.yml /tmp/yarnrc.yml \
 && yarn config set supportedArchitectures --json "{\"os\":[\"linux\"],\"cpu\":[\"$CPU\"],\"libc\":[\"musl\"]}" \
 && YARN_ENABLE_SCRIPTS=false yarn workspaces focus --production ${WS} \
 && cp /tmp/yarnrc.yml .yarnrc.yml

# Los scripts de build, ya en la arquitectura destino (emulada si no es la del builder). El `focus`
# encuentra todo descargado y enlazado, así que solo le queda ejecutar lo que se saltó arriba: compilar
# `bufferutil` y un par de `postinstall`. (`yarn rebuild` no vale: resuelve el monorepo entero, y aquí
# solo está el workspace.)
FROM ${BASE_IMAGE} AS build
ARG WS
WORKDIR /usr/src/app
RUN npm install -g corepack && corepack enable
# Compilador para los módulos nativos que no traen binario para musl. Hoy es `bufferutil` en arm64: su
# binario precompilado pide `ld-linux-aarch64.so.1`, el cargador de glibc, que Alpine no tiene; sin
# compilador la instalación falla en silencio (es opcional) y `ws` se queda con la versión en JavaScript.
# Solo en esta etapa, que se descarta: la imagen final no crece. En amd64 no se llega a usar.
RUN apk add --no-cache build-base python3
COPY --from=deps /usr/src/app ./
ENV NODE_ENV=production
ENV YARN_ENABLE_HARDENED_MODE=0
RUN corepack install && yarn workspaces focus --production ${WS}

FROM ${BASE_IMAGE} AS app
ARG RUTA
ARG WS
WORKDIR /usr/src/app
RUN apk add --no-cache tzdata
RUN npm install -g corepack && corepack enable
# Caché de corepack en una ruta fija de la imagen, y no bajo `$HOME`: si el pod arranca con otro
# usuario u otro `HOME` que el build, corepack no encontraría el Yarn preparado y lo descargaría.
ENV COREPACK_HOME=/usr/local/share/corepack
ENV NODE_ENV=production
RUN mkdir ./.yarn && mkdir ./files
COPY --from=build /usr/src/app/.yarn ./.yarn
COPY --from=build /usr/src/app/.pnp.* ./
COPY --from=build /usr/src/app/.yarnrc* ./
COPY --from=build /usr/src/app/yarn.lock ./
COPY ./package.json ./
# **El Yarn que se ejecuta al arrancar el pod tiene que estar ya en la imagen.** Corepack ejecuta la
# versión exacta de `packageManager`, y si no la tiene en su caché la descarga en el primer `yarn`
# de cada contenedor —o sea, en cada arranque—, aunque `yarnPath` apunte a `.yarn/releases`, que ya
# está dentro. Con `corepack prepare yarn@latest` la caché solo coincidía cuando `latest` era la
# versión fijada, y la capa vive en la caché del registro: se quedaba con el `latest` del día en que
# se construyó. `corepack install` prepara exactamente la de `packageManager` y, al ir detrás del
# `COPY ./package.json`, se rehace cuando esta cambia. El `yarn --version` sin red hace fallar el
# build, y no el arranque, si el día de mañana corepack volviera a necesitar la red.
RUN corepack install && COREPACK_ENABLE_NETWORK=0 yarn --version
COPY ./${RUTA}/${WS}/assets ./${RUTA}/${WS}/assets
COPY ./${RUTA}/${WS}/app.js ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/mrpack.json ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/output ./${RUTA}/${WS}/output
RUN echo "#!/usr/bin/env bash" > run.sh
RUN echo "[ -n \"\${DD_SERVICE}\" ] && export DD_SERVICE=\"\$(echo \"\${K8S_NAMESPACE:-default}\" | sed 's/meteored/mr/g')/\${DD_SERVICE}\"" >> run.sh
# El PID 1 tiene que ser Yarn, que sí reenvía SIGTERM a su hijo. Sin `exec` lo era `sh`, que ignora SIGTERM (al PID 1
# el kernel no le aplica la acción por defecto de una señal sin handler); y con `exec yarn` lo es el shim de corepack,
# que con `yarnPath` lanza el Yarn del repo como proceso hijo y tampoco reenvía la señal. Las dos cosas medidas en
# svc-status el 2026-11-12: Node no se enteraba del apagado y moría por SIGKILL al acabar la gracia. Por eso se arranca
# `node <yarnPath>` directamente; sin `yarnPath` en el `.yarnrc.yml` se queda `yarn`.
RUN Y="$(sed -n 's/^yarnPath:[[:space:]]*//p' .yarnrc.yml | tr -d "\"' \r")" && echo "exec ${Y:+node }${Y:-yarn} workspace ${WS} node --no-warnings app.js" >> run.sh
WORKDIR /usr/src/app/${RUTA}/${WS}
RUN ln -s ../../files ./
WORKDIR /usr/src/app

# Los dos de Datadog van al final de la etapa, después del último RUN, y no al principio. Un ARG
# declarado entra como variable de entorno en **todos** los RUN que vienen detrás, los use o no, y
# su valor forma parte de su clave de caché: como `DD_GIT_COMMIT_SHA` cambia en cada commit, el
# `apk add`, el corepack y el `corepack install` de esta etapa se ejecutaban en cada build, y en
# arm64 emulados (~30 s). Aquí ya solo afectan a sí mismos.
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

EXPOSE 8080
CMD [ "sh", "run.sh" ]

#USER node
