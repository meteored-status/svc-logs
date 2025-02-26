ARG BASE_IMAGE

FROM ${BASE_IMAGE} AS build
ARG RUTA
ARG WS
WORKDIR /usr/src/app
RUN mkdir ./.yarn && mkdir ./.yarn/unplugged
COPY ./.yarn/plugins ./.yarn/plugins
COPY ./.yarn/releases ./.yarn/releases
COPY ./.yarnrc.yml ./
COPY ./${RUTA}/${WS} ./${RUTA}/${WS}
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn workspaces focus --production ${WS}

FROM ${BASE_IMAGE} AS app
ARG RUTA
ARG WS
WORKDIR /usr/src/app
RUN echo "RUTA: ${RUTA}" && echo "WS: ${WS}"
ENV NODE_ENV=production
RUN mkdir ./.yarn && mkdir ./files
COPY --from=build /usr/src/app/.yarn ./.yarn
COPY --from=build /usr/src/app/.pnp.* ./
COPY --from=build /usr/src/app/.yarnrc* ./
COPY --from=build /usr/src/app/yarn.lock ./
COPY ./package.json ./
COPY ./${RUTA}/${WS}/assets ./${RUTA}/${WS}/assets
COPY ./${RUTA}/${WS}/app.js ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/init.js ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/mrpack.json ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}
COPY ./${RUTA}/${WS}/output ./${RUTA}/${WS}/output
RUN echo "#!/usr/bin/env bash" > run.sh
RUN echo "yarn workspace ${WS} node --no-warnings app.js" >> run.sh
WORKDIR /usr/src/app/${RUTA}/${WS}
RUN ln -s ../../files ./
WORKDIR /usr/src/app

EXPOSE 8080
CMD [ "sh", "run.sh" ]

#USER node
