ARG BASE_IMAGE

FROM ${BASE_IMAGE} as build
ARG ws
WORKDIR /usr/src/app
RUN mkdir ./.yarn && mkdir ./.yarn/unplugged
COPY ./.yarn/plugins ./.yarn/plugins
COPY ./.yarn/releases ./.yarn/releases
COPY ./.yarnrc* ./
COPY ./services/${ws} ./services/${ws}
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn workspaces focus --production ${ws}

FROM ${BASE_IMAGE} as app
ARG ws
WORKDIR /usr/src/app
ENV NODE_ENV=production
RUN mkdir ./.yarn && mkdir ./files
COPY --from=build /usr/src/app/.yarn ./.yarn
COPY --from=build /usr/src/app/.pnp.* ./
COPY --from=build /usr/src/app/.yarnrc* ./
COPY --from=build /usr/src/app/yarn.lock ./
COPY ./package.json ./
COPY ./services/${ws}/assets ./services/${ws}/assets
COPY ./services/${ws}/app.js ./services/${ws}
COPY ./services/${ws}/init.js ./services/${ws}
COPY ./services/${ws}/package.json ./services/${ws}
COPY ./services/${ws}/output ./services/${ws}/output
RUN echo "#!/usr/bin/env bash" > run.sh
RUN echo "yarn workspace ${ws} node --no-warnings app.js" >> run.sh
RUN cd ./services/${ws} && ln -s ../../files ./ && cd ../..

EXPOSE 8080
CMD [ "sh", "run.sh" ]

#USER node
