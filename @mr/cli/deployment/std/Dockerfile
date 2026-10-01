ARG BASE_IMAGE=node:lts-alpine

# La etapa de build existe solo para resolver `node_modules` de producción: nada de lo que se
# compila aquí acaba en la imagen salvo `.yarn`, `.pnp.*` y `yarn.lock`. Por eso **no copia código**
# y por eso no declara los dos ARG de Datadog: `DD_GIT_COMMIT_SHA` cambia en cada commit, y un ARG
# declarado en esta etapa arrastraría su valor a la clave de caché del install, que es justo la capa
# que interesa reutilizar entre despliegues.
FROM ${BASE_IMAGE} AS build
ARG RUTA
ARG WS
WORKDIR /usr/src/app
RUN mkdir ./.yarn && mkdir ./.yarn/unplugged
COPY ./.yarn/plugins ./.yarn/plugins
COPY ./.yarn/releases ./.yarn/releases
COPY ./.yarnrc.yml ./
COPY ./package.json ./yarn.lock ./
# Solo el manifiesto del workspace, no el workspace entero. `focus --production` ignora las
# `devDependencies`, que es donde viven todas las dependencias entre workspaces (`services-comun`,
# `@mr/core-*`, `i18n`...), así que no hace falta que existan sus directorios — de hecho nunca se
# copiaron. Copiar el workspace completo invalidaba esta capa con cualquier cambio de código, y en
# un servicio Next.js metía además el `.next` entero en una etapa que lo tira a la basura.
COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}/
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
# paquete desde su `.zip` dentro de `.yarn/cache`, y el `COPY --from=build /usr/src/app/.yarn` de la
# etapa de abajo es lo que lo mete en la imagen. Montarla con `--mount=type=bind` deja los zips en el
# montaje, que se descarta al acabar la instrucción: la imagen sale con un `.pnp.cjs` que apunta a
# unos zips que no existen y el contenedor muere al arrancar con «Required package missing from disk».
# Se probó, y es lo que pasó. Para saltarse la descarga de npm está la caché de capas del registro,
# que reutiliza esta capa entera —zips incluidos— mientras no cambien `yarn.lock` ni el
# `package.json` del workspace.
RUN yarn workspaces focus --production ${WS}

FROM ${BASE_IMAGE} AS app
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ARG RUTA
ARG WS
WORKDIR /usr/src/app
RUN apk add --no-cache tzdata
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}
ENV NODE_ENV=production
RUN mkdir ./.yarn && mkdir ./files
COPY --from=build /usr/src/app/.yarn ./.yarn
COPY --from=build /usr/src/app/.pnp.* ./
COPY --from=build /usr/src/app/.yarnrc* ./
COPY --from=build /usr/src/app/yarn.lock ./
COPY ./package.json ./
COPY ./${RUTA}/${WS}/assets ./${RUTA}/${WS}/assets
COPY ./${RUTA}/${WS}/app.js ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/mrpack.json ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/output ./${RUTA}/${WS}/output
RUN echo "#!/usr/bin/env bash" > run.sh
RUN echo "[ -n \"\${DD_SERVICE}\" ] && export DD_SERVICE=\"\$(echo \"\${K8S_NAMESPACE:-default}\" | sed 's/meteored/mr/g')/\${DD_SERVICE}\"" >> run.sh
RUN echo "yarn workspace ${WS} node --no-warnings app.js" >> run.sh
WORKDIR /usr/src/app/${RUTA}/${WS}
RUN ln -s ../../files ./
WORKDIR /usr/src/app

EXPOSE 8080
CMD [ "sh", "run.sh" ]

#USER node
