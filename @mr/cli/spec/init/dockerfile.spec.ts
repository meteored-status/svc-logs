/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: b79b42c7254e9c13b1e79f0e335a1346
 * Versión: 2026.11.13+1-bixus
 * Anterior: 2026.11.9+8-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {COMENTARIO_ARRANQUE, COMPILADOR, COREPACK, COREPACK_HOME, COREPACK_INSTALL, COREPACK_INSTALL_FINAL, lineaArranque, parchearArranque, parchearCorepack} from "../../src/clases/init/dockerfile";

/**
 * Las líneas de una etapa del Dockerfile parcheado, sin comentarios ni líneas vacías.
 *
 * @param contenido - Dockerfile parcheado.
 * @param num - Número de la etapa, desde 1.
 * @returns Las instrucciones de esa etapa.
 */
function etapa(contenido: string, num: number): string[] {
    return contenido.split(/^(?=FROM\s)/m).filter((t) => t.startsWith("FROM"))[num - 1]
        .split("\n").filter((l) => l.trim()!=="" && !l.startsWith("#"));
}

/**
 * Comprueba que `despues` va justo detrás de `antes` en `lineas`.
 *
 * @param lineas - Instrucciones de una etapa.
 * @param antes - Línea ancla.
 * @param despues - Línea que tiene que ir detrás.
 */
function detras(lineas: string[], antes: string, despues: string): void {
    const i = lineas.indexOf(antes);
    assert.notEqual(i, -1, `falta «${antes}»`);
    assert.equal(lineas[i + 1], despues, `detrás de «${antes}» va «${lineas[i + 1]}»`);
}

// Forma de los Dockerfile propios parcheados con la versión anterior (`prepare yarn@latest`), como
// localizacion-gazetteer-api de svc-localizacion.
const CON_LATEST = [
    "ARG BASE_IMAGE=node:lts-alpine",
    "",
    "FROM ${BASE_IMAGE} AS build",
    "ARG RUTA",
    "ARG WS",
    "WORKDIR /usr/src/app",
    "RUN npm install -g corepack && corepack enable && corepack prepare yarn@latest --activate",
    "COPY ./.yarn/releases ./.yarn/releases",
    "COPY ./.yarnrc.yml ./",
    "COPY ./package.json ./yarn.lock ./",
    "COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}/",
    "RUN yarn workspaces focus --production ${WS}",
    "",
    "FROM ${BASE_IMAGE} AS app",
    "ARG RUTA",
    "ARG WS",
    "WORKDIR /usr/src/app",
    "RUN apk add --no-cache tzdata",
    "RUN npm install -g corepack && corepack enable && corepack prepare yarn@latest --activate",
    "RUN apk add --no-cache postgresql18-client",
    "ENV NODE_ENV=production",
    "COPY --from=build /usr/src/app/.yarn ./.yarn",
    "COPY --from=build /usr/src/app/.yarnrc* ./",
    "COPY ./package.json ./",
    "COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}",
    "RUN echo \"yarn workspace ${WS} node --no-warnings app.js\" >> run.sh",
    "CMD [ \"sh\", \"run.sh\" ]",
    "",
].join("\n");

// Forma de los que aún no tienen corepack: `COPY package.json ./` sin `./` y el `yarn.lock` aparte,
// como newsletter-generate de svc-newsletter.
const SIN_COREPACK = [
    "ARG BASE_IMAGE",
    "FROM ${BASE_IMAGE} AS build",
    "WORKDIR /usr/src/app",
    "RUN apk add --no-cache tzdata",
    "COPY ./.yarnrc* ./",
    "COPY ./${RUTA}/${WS} ./${RUTA}/${WS}",
    "COPY package.json ./",
    "COPY ./yarn.lock ./",
    "RUN yarn workspaces focus --production ${WS}",
    "FROM ${BASE_IMAGE} AS app",
    "WORKDIR /usr/src/app",
    "RUN apk add --no-cache tzdata",
    "COPY --from=build /usr/src/app/.yarn ./.yarn",
    "COPY package.json ./",
    "COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}",
    "RUN echo \"yarn workspace ${WS} node app.js\" >> run.sh",
    "WORKDIR /usr/src/app/${RUTA}/${WS}",
    "WORKDIR /usr/src/app",
    "RUN apk add --no-cache tzdata",
    "CMD [ \"sh\", \"run.sh\" ]",
    "",
].join("\n");

describe("parchearCorepack", () => {
    it("cambia `prepare yarn@latest` por `corepack install` detrás del package.json raíz", () => {
        const {contenido, avisos} = parchearCorepack(CON_LATEST);
        assert.deepEqual(avisos, []);
        assert.doesNotMatch(contenido, /yarn@latest/);

        const build = etapa(contenido, 1);
        assert.ok(build.includes(COREPACK));
        detras(build, "COPY ./package.json ./yarn.lock ./", COREPACK_INSTALL);
        assert.ok(!build.includes(COREPACK_HOME), "COREPACK_HOME solo en la etapa final");

        const app = etapa(contenido, 2);
        detras(app, "RUN apk add --no-cache tzdata", COREPACK);
        detras(app, COREPACK, COREPACK_HOME);
        detras(app, "COPY ./package.json ./", COREPACK_INSTALL_FINAL);
    });

    it("añade corepack donde no lo había, tras el primer tzdata, y no toma el package.json del workspace", () => {
        const {contenido, avisos} = parchearCorepack(SIN_COREPACK);
        assert.deepEqual(avisos, []);

        const build = etapa(contenido, 1);
        detras(build, "RUN apk add --no-cache tzdata", COREPACK);
        detras(build, "COPY package.json ./", COREPACK_INSTALL);

        const app = etapa(contenido, 2);
        assert.equal(app.filter((l) => l===COREPACK).length, 1);
        detras(app, "RUN apk add --no-cache tzdata", COREPACK);
        detras(app, "COPY package.json ./", COREPACK_INSTALL_FINAL);
        assert.ok(!app.includes(COREPACK_INSTALL), "en la final solo va la forma con la comprobación sin red");
    });

    it("pone el compilador en la etapa de build, detrás de corepack, y no en la final", () => {
        for (const original of [CON_LATEST, SIN_COREPACK]) {
            const {contenido} = parchearCorepack(original);
            detras(etapa(contenido, 1), COREPACK, COMPILADOR);
            assert.ok(!etapa(contenido, 2).includes(COMPILADOR), "la imagen final no lleva compilador");
        }
    });

    it("no pone compilador si el Dockerfile no es de Alpine (no usa apk)", () => {
        const debian = CON_LATEST.replace("RUN apk add --no-cache tzdata\n", "").replace("RUN apk add --no-cache postgresql18-client\n", "");
        const {contenido, avisos} = parchearCorepack(debian);
        assert.doesNotMatch(contenido, /build-base/);
        assert.deepEqual(avisos, []);
    });

    it("avisa, sin compilador, si las dependencias se instalan en la etapa final", () => {
        const original = "FROM node:lts-alpine\nWORKDIR /usr/src/app\nRUN apk add --no-cache tzdata\nCOPY ./package.json ./yarn.lock ./\nRUN yarn workspaces focus --production app\nCMD yarn start\n";
        const {contenido, avisos} = parchearCorepack(original);
        assert.doesNotMatch(contenido, /build-base/);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /^Etapa 1: instala las dependencias en la etapa final/);
    });

    it("corrige el `RUN corepack enable` sin npm de la primera versión", () => {
        const legacy = SIN_COREPACK.replace("FROM ${BASE_IMAGE} AS app\nWORKDIR /usr/src/app\n", "FROM ${BASE_IMAGE} AS app\nWORKDIR /usr/src/app\nRUN corepack enable\n");
        const app = etapa(parchearCorepack(legacy).contenido, 2);
        assert.ok(!app.includes("RUN corepack enable"));
        detras(app, "WORKDIR /usr/src/app", COREPACK);
        assert.equal(app.filter((l) => l===COREPACK).length, 1);
    });

    it("aplicado dos veces no cambia nada", () => {
        for (const original of [CON_LATEST, SIN_COREPACK]) {
            const una = parchearCorepack(original).contenido;
            const dos = parchearCorepack(una);
            assert.equal(dos.contenido, una);
            assert.deepEqual(dos.avisos, []);
        }
    });

    it("deja intactos los Dockerfile estándar de deployment/std, que ya están así", () => {
        // tmp/spec/spec/init → raíz del workspace.
        const std = path.join(__dirname, "../../../../deployment/std");
        for (const nombre of ["Dockerfile", "Dockerfile-next"]) {
            const original = fs.readFileSync(path.join(std, nombre), "utf8");
            const {contenido, avisos} = parchearCorepack(original);
            assert.deepEqual(avisos, [], nombre);
            assert.equal(contenido, original, `${nombre} no tiene la forma que deja el parche`);
        }
    });

    it("no toca las etapas que no usan Yarn", () => {
        const original = "FROM alpine AS certs\nRUN apk add ca-certificates\nCOPY package.json ./\n" + CON_LATEST.replace("ARG BASE_IMAGE=node:lts-alpine\n\n", "");
        const {contenido} = parchearCorepack(original);
        assert.deepEqual(etapa(contenido, 1), ["FROM alpine AS certs", "RUN apk add ca-certificates", "COPY package.json ./"]);
    });

    it("avisa y no inserta `corepack install` si la etapa no copia el package.json raíz", () => {
        const original = "FROM node AS app\nWORKDIR /usr/src/app\nCOPY --from=build /usr/src/app/package.json ./\nCMD yarn start\n";
        const {contenido, avisos} = parchearCorepack(original);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /^Etapa 1: .*descargará al arrancar/);
        assert.doesNotMatch(contenido, /corepack install/);
        detras(etapa(contenido, 1), "WORKDIR /usr/src/app", COREPACK);
    });

    it("avisa y no toca una etapa que habilita corepack de otra forma", () => {
        const original = "FROM node AS app\nRUN corepack enable yarn && echo listo\nCOPY ./package.json ./\nCMD yarn start\n";
        const {contenido, avisos} = parchearCorepack(original);
        assert.equal(contenido, original);
        assert.equal(avisos.length, 1);
    });
});

describe("run.sh de los Dockerfile estándar", () => {
    // tmp/spec/spec/init → raíz del workspace.
    const std = path.join(__dirname, "../../../../deployment/std");

    /**
     * Ejecuta, como haría `docker build`, los `RUN` que escriben `run.sh` y devuelve su última línea.
     *
     * @param nombre - Dockerfile de `deployment/std`.
     * @param yarnrc - Contenido del `.yarnrc.yml`, o `null` si no hay.
     * @returns La línea que arranca el servicio.
     */
    function arranque(nombre: string, yarnrc: string|null): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "run-sh-"));
        try {
            if (yarnrc!==null) {
                fs.writeFileSync(path.join(dir, ".yarnrc.yml"), yarnrc);
            }
            const lineas = fs.readFileSync(path.join(std, nombre), "utf8").split("\n");
            assert.ok(lineas.includes("CMD [ \"sh\", \"run.sh\" ]"), `${nombre}: el entrypoint ya no es run.sh`);
            for (const l of lineas.filter((l) => l.startsWith("RUN ") && /\s>>?\s*run\.sh$/.test(l))) {
                execFileSync("/bin/sh", ["-c", l.slice(4)], {cwd: dir, env: {...process.env, WS: "ws-prueba"}, stdio: ["ignore", "ignore", "ignore"]});
            }
            const script = fs.readFileSync(path.join(dir, "run.sh"), "utf8").trimEnd().split("\n");
            return script[script.length - 1];
        } finally {
            fs.rmSync(dir, {recursive: true, force: true});
        }
    }

    it("arranca con `exec node <yarnPath>`: ni `sh` ni el shim de corepack reenvían SIGTERM", () => {
        const cola = {"Dockerfile": "node --no-warnings app.js", "Dockerfile-next": "run next start -p 8080"};
        for (const [nombre, resto] of Object.entries(cola)) {
            const esperado = `exec node .yarn/releases/yarn-9.9.9.cjs workspace ws-prueba ${resto}`;
            assert.equal(arranque(nombre, "nodeLinker: pnp\nyarnPath: .yarn/releases/yarn-9.9.9.cjs\n"), esperado, nombre);
            assert.equal(arranque(nombre, "yarnPath: \".yarn/releases/yarn-9.9.9.cjs\"\r\n"), esperado, `${nombre}, entre comillas y CRLF`);
            // Sin yarnPath no hay Yarn del repo que lanzar: se queda el de corepack.
            assert.equal(arranque(nombre, "nodeLinker: pnp\n"), `exec yarn workspace ws-prueba ${resto}`, `${nombre}, sin yarnPath`);
            assert.equal(arranque(nombre, null), `exec yarn workspace ws-prueba ${resto}`, `${nombre}, sin .yarnrc.yml`);
        }
    });
});

describe("parchearArranque", () => {
    it("cambia el arranque antiguo de run.sh por `exec node <yarnPath>`, con su comentario", () => {
        for (const [original, resto] of [[CON_LATEST, "node --no-warnings app.js"], [SIN_COREPACK, "node app.js"]]) {
            const {contenido, avisos} = parchearArranque(original);
            assert.deepEqual(avisos, []);
            assert.doesNotMatch(contenido, /^RUN echo "yarn workspace/m);
            detras(etapa(`${contenido}`.replace(/^# .*\n/gm, ""), 2), "COPY ./${RUTA}/${WS}/package.json ./${RUTA}/${WS}", lineaArranque(resto));
            assert.ok(contenido.includes(`${COMENTARIO_ARRANQUE}\n${lineaArranque(resto)}\n`));
        }
    });

    it("también el que ya llevaba `exec yarn`, que deja de PID 1 al shim de corepack", () => {
        const original = CON_LATEST.replace("RUN echo \"yarn workspace", "RUN echo \"exec yarn workspace");
        assert.ok(parchearArranque(original).contenido.includes(lineaArranque("node --no-warnings app.js")));
    });

    it("aplicarlo dos veces no cambia nada", () => {
        for (const original of [CON_LATEST, SIN_COREPACK]) {
            const una = parchearArranque(original).contenido;
            assert.deepEqual(parchearArranque(una), {contenido: una, avisos: []});
        }
    });

    it("los Dockerfile estándar ya arrancan así", () => {
        // tmp/spec/spec/init → raíz del workspace.
        const std = path.join(__dirname, "../../../../deployment/std");
        for (const [nombre, resto] of [["Dockerfile", "node --no-warnings app.js"], ["Dockerfile-next", "run next start -p 8080"]]) {
            const original = fs.readFileSync(path.join(std, nombre), "utf8");
            assert.ok(original.includes(`${COMENTARIO_ARRANQUE}\n${lineaArranque(resto)}\n`), `${nombre} no arranca como lineaArranque()`);
            assert.deepEqual(parchearArranque(original), {contenido: original, avisos: []}, nombre);
        }
    });

    it("avisa y no toca un arranque con Yarn que no reconoce", () => {
        const original = "FROM node AS app\nWORKDIR /usr/src/app\nCOPY ./package.json ./\nCMD yarn start\n";
        const {contenido, avisos} = parchearArranque(original);
        assert.equal(contenido, original);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0], /^Etapa 1: no reconozco cómo arranca/);
    });

    it("no dice nada si la etapa final no arranca con Yarn", () => {
        const original = "FROM node AS build\nRUN yarn install\nFROM nginx AS app\nCMD [\"nginx\", \"-g\", \"daemon off;\"]\n";
        assert.deepEqual(parchearArranque(original), {contenido: original, avisos: []});
    });
});
