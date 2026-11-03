/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 9378acdcc947f6809831a2942a31a099
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import assert from "node:assert/strict";
import {mkdir, mkdtemp, rm, writeFile} from "node:fs/promises";
import http from "node:http";
import type {AddressInfo} from "node:net";
import os from "node:os";
import path from "node:path";
import {after, afterEach, before, beforeEach, describe, it} from "node:test";

import {CONFIG_EMULADOR_DEFECTO, leerConfigEmulador, resolverConfigEmulador} from "../pubsub/config.ts";
import {
    compararSuscripcion,
    definirPubSub,
    describirDiferencias,
    endpointPush,
    fusionar,
    puertoPush,
    validarDeclaracion,
    type IConfigComparacion,
    type IDeclaracionPubSub,
    type ISuscripcionDeclarada,
    type ISuscripcionEmulador,
} from "../pubsub/declaracion.ts";
import {buscarDeclaraciones} from "../pubsub/descubrir.ts";
import {EmuladorPubSub, mensajeEmuladorCaido} from "../pubsub/emulador.ts";

const ORIGEN = "services/prueba";
const CONFIG: IConfigComparacion = {proyecto: "meteored-local", pushHost: "host.docker.internal"};

const valida = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    nombre: "suscripcion-uno",
    topic: "topic-uno",
    ...extra,
});

const rechaza = (valor: unknown, patron: RegExp): void => {
    assert.throws(() => validarDeclaracion(valor, ORIGEN), (err: Error) => {
        assert.match(err.message, patron);
        assert.match(err.message, new RegExp(ORIGEN));
        return true;
    });
};

describe("validarDeclaracion", () => {
    it("acepta una declaración vacía", () => {
        assert.deepEqual(validarDeclaracion({}, ORIGEN), {});
    });

    it("acepta una declaración completa y la devuelve sin claves undefined", () => {
        const declaracion = {
            topics: ["topic-uno"],
            suscripciones: [{
                nombre: "suscripcion-uno",
                topic: "topic-uno",
                filtro: 'attributes.a = "b"',
                push: {base: "http://localhost:17073", ruta: "/x"},
                ackDeadline: 120,
            }],
        };
        assert.deepEqual(validarDeclaracion(declaracion, ORIGEN), declaracion);
        assert.deepEqual(validarDeclaracion({suscripciones: [valida({filtro: undefined, push: undefined, ackDeadline: undefined})]}, ORIGEN), {
            suscripciones: [{nombre: "suscripcion-uno", topic: "topic-uno"}],
        });
    });

    it("rechaza lo que no es un objeto", () => {
        rechaza(null, /debe ser un objeto/);
        rechaza([], /debe ser un objeto/);
        rechaza("topics", /debe ser un objeto/);
    });

    it("rechaza una clave desconocida en la raíz", () => {
        rechaza({topic: ["topic-uno"]}, /clave desconocida "topic"/);
    });

    it("rechaza una clave desconocida en una suscripción", () => {
        rechaza({suscripciones: [valida({ackdeadline: 30})]}, /clave desconocida "ackdeadline"/);
    });

    it("rechaza una clave desconocida en push", () => {
        rechaza({suscripciones: [valida({push: {base: "http://localhost:8080", puerto: 1}})]}, /clave desconocida "puerto"/);
    });

    it("rechaza topics que no son una lista y suscripciones que no son una lista", () => {
        rechaza({topics: "topic-uno"}, /topics: debe ser una lista/);
        rechaza({suscripciones: {}}, /suscripciones: debe ser una lista/);
    });

    it("rechaza un nombre de topic que no es válido", () => {
        rechaza({topics: ["ab"]}, /topics\[0\].*no es un nombre válido/);
        rechaza({topics: ["1abc"]}, /no es un nombre válido/);
        rechaza({topics: ["con espacio"]}, /no es un nombre válido/);
        rechaza({topics: ["con/barra"]}, /no es un nombre válido/);
        rechaza({topics: ["a".repeat(256)]}, /no es un nombre válido/);
        rechaza({topics: [42]}, /debe ser una cadena/);
    });

    it("acepta los nombres en el límite", () => {
        assert.doesNotThrow(() => validarDeclaracion({topics: ["abc", `a${"b".repeat(254)}`, "a-b_c.d~e+f%g"]}, ORIGEN));
    });

    it("rechaza un nombre que empieza por goog", () => {
        rechaza({topics: ["google-topic"]}, /no pueden empezar por "goog"/);
        rechaza({suscripciones: [valida({nombre: "goog-sub"})]}, /no pueden empezar por "goog"/);
    });

    it("rechaza una suscripción con nombre o topic inválidos", () => {
        rechaza({suscripciones: [valida({nombre: "x"})]}, /suscripciones\[0\]\.nombre.*no es un nombre válido/);
        rechaza({suscripciones: [valida({topic: "x"})]}, /suscripciones\[0\]\.topic.*no es un nombre válido/);
        rechaza({suscripciones: ["suscripcion-uno"]}, /debe ser un objeto/);
    });

    it("rechaza un filtro vacío", () => {
        rechaza({suscripciones: [valida({filtro: ""})]}, /filtro.*no vacía/);
        rechaza({suscripciones: [valida({filtro: "   "})]}, /filtro.*no vacía/);
        rechaza({suscripciones: [valida({filtro: 3})]}, /filtro.*no vacía/);
    });

    it("rechaza un push.base que no es una URL http/https con puerto explícito", () => {
        rechaza({suscripciones: [valida({push: {base: "http://localhost"}})]}, /push\.base.*puerto explícito/);
        rechaza({suscripciones: [valida({push: {base: "ftp://localhost:21"}})]}, /push\.base.*puerto explícito/);
        rechaza({suscripciones: [valida({push: {base: "localhost:8080"}})]}, /push\.base.*puerto explícito/);
        rechaza({suscripciones: [valida({push: {base: "no es una url"}})]}, /push\.base/);
        rechaza({suscripciones: [valida({push: {base: 8080}})]}, /push\.base.*cadena/);
        rechaza({suscripciones: [valida({push: {}})]}, /push\.base.*cadena/);
        rechaza({suscripciones: [valida({push: "http://localhost:8080"})]}, /push.*debe ser un objeto/);
    });

    it("rechaza un puerto fuera de rango", () => {
        rechaza({suscripciones: [valida({push: {base: "http://localhost:0"}})]}, /fuera de rango/);
        rechaza({suscripciones: [valida({push: {base: "http://localhost:70000"}})]}, /fuera de rango|URL válida/);
    });

    it("acepta un push.base con puerto explícito, aunque sea el del protocolo, y con IPv6", () => {
        assert.doesNotThrow(() => validarDeclaracion({suscripciones: [valida({push: {base: "http://localhost:80"}})]}, ORIGEN));
        assert.doesNotThrow(() => validarDeclaracion({suscripciones: [valida({push: {base: "https://localhost:8443/"}})]}, ORIGEN));
        assert.doesNotThrow(() => validarDeclaracion({suscripciones: [valida({push: {base: "http://[::1]:8080"}})]}, ORIGEN));
    });

    it("rechaza una push.ruta que no empieza por /", () => {
        rechaza({suscripciones: [valida({push: {base: "http://localhost:8080", ruta: "tareas"}})]}, /push\.ruta.*empiece por "\/"/);
        rechaza({suscripciones: [valida({push: {base: "http://localhost:8080", ruta: 3}})]}, /push\.ruta/);
    });

    it("rechaza un ackDeadline que no es un entero entre 10 y 600", () => {
        for (const ackDeadline of [9, 601, 10.5, "30", null, Number.NaN]) {
            rechaza({suscripciones: [valida({ackDeadline})]}, /ackDeadline.*entero entre 10 y 600/);
        }
        assert.doesNotThrow(() => validarDeclaracion({suscripciones: [valida({ackDeadline: 10}), valida({nombre: "suscripcion-dos", ackDeadline: 600})]}, ORIGEN));
    });

    it("rechaza nombres de topic repetidos", () => {
        rechaza({topics: ["topic-uno", "topic-dos", "topic-uno"]}, /topics\[2\].*repetido/);
    });

    it("rechaza nombres de suscripción repetidos", () => {
        rechaza({suscripciones: [valida(), valida({topic: "topic-dos"})]}, /suscripciones\[1\]\.nombre.*repetida/);
    });

    it("admite un topic y una suscripción con el mismo nombre: son recursos distintos", () => {
        assert.doesNotThrow(() => validarDeclaracion({topics: ["mismo-nombre"], suscripciones: [valida({nombre: "mismo-nombre"})]}, ORIGEN));
    });
});

describe("definirPubSub", () => {
    it("devuelve la misma declaración", () => {
        const declaracion: IDeclaracionPubSub = {topics: ["topic-uno"]};
        assert.equal(definirPubSub(declaracion), declaracion);
    });

    it("valida con mrpack.pubsub.ts como origen", () => {
        assert.throws(() => definirPubSub({topics: ["ab"]}), /^Error: mrpack\.pubsub\.ts: topics\[0\]/);
    });
});

describe("fusionar", () => {
    it("une topics y suscripciones, con el consumidor de cada suscripción", () => {
        const topologia = fusionar([
            {workspace: "packages/base", declaracion: {topics: ["topic-uno"]}},
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub-a", topic: "topic-uno", filtro: 'attributes.x = "a"'}]}},
        ]);
        assert.deepEqual(topologia, {
            topics: [{nombre: "topic-uno", declaradoPor: ["packages/base"], deducido: false}],
            suscripciones: [{nombre: "sub-a", topic: "topic-uno", filtro: 'attributes.x = "a"', consumidor: "services/a"}],
        });
    });

    it("deduce los topics que solo aparecen en una suscripción", () => {
        const topologia = fusionar([
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub-a", topic: "topic-ajeno"}]}},
        ]);
        assert.deepEqual(topologia.topics, [{nombre: "topic-ajeno", declaradoPor: [], deducido: true}]);
    });

    it("no marca como deducido un topic que alguien declara, aunque también lo referencie una suscripción", () => {
        const topologia = fusionar([
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub-a", topic: "topic-uno"}]}},
            {workspace: "packages/base", declaracion: {topics: ["topic-uno"]}},
        ]);
        assert.deepEqual(topologia.topics, [{nombre: "topic-uno", declaradoPor: ["packages/base"], deducido: false}]);
    });

    it("admite varios publicadores del mismo topic", () => {
        const topologia = fusionar([
            {workspace: "services/b", declaracion: {topics: ["topic-uno"]}},
            {workspace: "services/a", declaracion: {topics: ["topic-uno"]}},
        ]);
        assert.deepEqual(topologia.topics, [{nombre: "topic-uno", declaradoPor: ["services/a", "services/b"], deducido: false}]);
    });

    it("rechaza una suscripción declarada por dos workspaces", () => {
        assert.throws(() => fusionar([
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub-a", topic: "topic-uno"}]}},
            {workspace: "services/b", declaracion: {suscripciones: [{nombre: "sub-a", topic: "topic-uno"}]}},
        ]), (err: Error) => {
            assert.match(err.message, /sub-a/);
            assert.match(err.message, /services\/a/);
            assert.match(err.message, /services\/b/);
            assert.match(err.message, /único consumidor/);
            return true;
        });
    });

    it("ordena alfabéticamente, sin depender del orden de entrada", () => {
        const a = {workspace: "services/a", declaracion: {topics: ["topic-b"], suscripciones: [{nombre: "sub-z", topic: "topic-c"}, {nombre: "sub-m", topic: "topic-b"}]}};
        const b = {workspace: "services/b", declaracion: {topics: ["topic-a"], suscripciones: [{nombre: "sub-a", topic: "topic-a"}]}};
        const directa = fusionar([a, b]);
        assert.deepEqual(directa, fusionar([b, a]));
        assert.deepEqual(directa.topics.map(({nombre}) => nombre), ["topic-a", "topic-b", "topic-c"]);
        assert.deepEqual(directa.suscripciones.map(({nombre}) => nombre), ["sub-a", "sub-m", "sub-z"]);
    });

    it("valida otra vez cada declaración, con el workspace como origen", () => {
        assert.throws(() => fusionar([
            {workspace: "services/a", declaracion: {topics: ["ab"]}},
        ]), /^Error: services\/a: topics\[0\]/);
    });

    it("una topología vacía no tiene nada", () => {
        assert.deepEqual(fusionar([]), {topics: [], suscripciones: []});
    });
});

describe("endpointPush", () => {
    it("cambia el host por pushHost y conserva protocolo y puerto", () => {
        assert.equal(endpointPush({base: "http://localhost:17073"}, "host.docker.internal"), "http://host.docker.internal:17073/");
    });

    it("añade la ruta", () => {
        assert.equal(endpointPush({base: "http://localhost:17073", ruta: "/tareas/nueva"}, "host.docker.internal"), "http://host.docker.internal:17073/tareas/nueva");
    });

    it("conserva el protocolo https", () => {
        assert.equal(endpointPush({base: "https://localhost:8443"}, "h"), "https://h:8443/");
    });

    it("conserva un puerto explícito que es el del protocolo", () => {
        assert.equal(endpointPush({base: "http://localhost:80"}, "h"), "http://h:80/");
        assert.equal(endpointPush({base: "https://localhost:443"}, "h"), "https://h:443/");
    });

    it("ignora la ruta que lleve base: la ruta va en push.ruta", () => {
        assert.equal(endpointPush({base: "http://localhost:8080/ignorada?x=1", ruta: "/buena"}, "h"), "http://h:8080/buena");
    });
});

describe("puertoPush", () => {
    it("devuelve el puerto escrito en la base", () => {
        assert.equal(puertoPush({base: "http://localhost:17073"}), "17073");
        assert.equal(puertoPush({base: "https://localhost:8443/"}), "8443");
    });

    it("resuelve el puerto por defecto del protocolo, que URL.port deja vacío", () => {
        assert.equal(new URL("http://localhost:80").port, "");
        assert.equal(puertoPush({base: "http://localhost:80"}), "80");
        assert.equal(puertoPush({base: "https://localhost:443"}), "443");
    });
});

describe("compararSuscripcion", () => {
    const declarada = (extra: Partial<ISuscripcionDeclarada> = {}): ISuscripcionDeclarada => ({nombre: "sub-a", topic: "topic-uno", ...extra});
    const existente = (extra: Partial<ISuscripcionEmulador> = {}): ISuscripcionEmulador => ({nombre: "sub-a", topic: "topic-uno", ackDeadline: 10, labels: {}, ...extra});
    const push = {base: "http://localhost:17073", ruta: "/"};

    it("son iguales si no difiere nada", () => {
        assert.equal(compararSuscripcion(declarada(), existente(), CONFIG), "igual");
        assert.equal(compararSuscripcion(
            declarada({filtro: "a", push, ackDeadline: 120}),
            existente({filtro: "a", pushEndpoint: "http://host.docker.internal:17073/", ackDeadline: 120}),
            CONFIG,
        ), "igual");
    });

    it("se recrea si difiere el topic", () => {
        assert.equal(compararSuscripcion(declarada({topic: "topic-dos"}), existente(), CONFIG), "recrear");
    });

    it("reconoce un topic dado como ruta completa del mismo proyecto, y no el de otro", () => {
        assert.equal(compararSuscripcion(declarada(), existente({topic: "projects/meteored-local/topics/topic-uno"}), CONFIG), "igual");
        assert.equal(compararSuscripcion(declarada(), existente({topic: "projects/otro/topics/topic-uno"}), CONFIG), "recrear");
    });

    it("se recrea si difiere el filtro", () => {
        assert.equal(compararSuscripcion(declarada({filtro: "a"}), existente({filtro: "b"}), CONFIG), "recrear");
        assert.equal(compararSuscripcion(declarada({filtro: "a"}), existente(), CONFIG), "recrear");
        assert.equal(compararSuscripcion(declarada(), existente({filtro: "b"}), CONFIG), "recrear");
    });

    it("trata un filtro vacío como ausente", () => {
        assert.equal(compararSuscripcion(declarada(), existente({filtro: ""}), CONFIG), "igual");
    });

    it("se recrea si difiere el ackDeadline", () => {
        assert.equal(compararSuscripcion(declarada({ackDeadline: 120}), existente({ackDeadline: 600}), CONFIG), "recrear");
        assert.equal(compararSuscripcion(declarada({ackDeadline: 120}), existente(), CONFIG), "recrear");
    });

    it("trata un ackDeadline sin declarar como el 10 por defecto del emulador", () => {
        assert.equal(compararSuscripcion(declarada(), existente({ackDeadline: 10}), CONFIG), "igual");
        assert.equal(compararSuscripcion(declarada(), existente({ackDeadline: 600}), CONFIG), "recrear");
        assert.equal(compararSuscripcion(declarada({ackDeadline: 10}), existente({ackDeadline: 10}), CONFIG), "igual");
    });

    it("solo hay que modificar el push si difiere el endpoint", () => {
        assert.equal(compararSuscripcion(declarada({push}), existente({pushEndpoint: "http://host.docker.internal:1111/"}), CONFIG), "push");
        assert.equal(compararSuscripcion(declarada({push: {base: "http://localhost:17073", ruta: "/otra"}}), existente({pushEndpoint: "http://host.docker.internal:17073/"}), CONFIG), "push");
    });

    it("pasar de pull a push, o de push a pull, es modificar el push", () => {
        assert.equal(compararSuscripcion(declarada({push}), existente(), CONFIG), "push");
        assert.equal(compararSuscripcion(declarada(), existente({pushEndpoint: "http://host.docker.internal:17073/"}), CONFIG), "push");
    });

    it("trata un endpoint vacío como ausente", () => {
        assert.equal(compararSuscripcion(declarada(), existente({pushEndpoint: ""}), CONFIG), "igual");
    });

    it("el pushHost decide el endpoint esperado", () => {
        assert.equal(compararSuscripcion(declarada({push}), existente({pushEndpoint: "http://host.docker.internal:17073/"}), {...CONFIG, pushHost: "otro-host"}), "push");
    });

    it("recrear gana a push cuando difieren las dos cosas", () => {
        assert.equal(compararSuscripcion(declarada({push, filtro: "a"}), existente({pushEndpoint: "http://x:1/"}), CONFIG), "recrear");
    });

    it("describirDiferencias lista cada propiedad, primero las que obligan a recrear", () => {
        assert.deepEqual(describirDiferencias(declarada({push, filtro: "a", ackDeadline: 120}), existente(), CONFIG), [
            'filtro: "" -> "a"',
            "ackDeadline: 10 -> 120",
            "push: pull -> http://host.docker.internal:17073/",
        ]);
        assert.deepEqual(describirDiferencias(declarada(), existente(), CONFIG), []);
    });
});

describe("resolverConfigEmulador", () => {
    it("sin nada, usa los valores por defecto", () => {
        assert.deepEqual(resolverConfigEmulador({env: {}}), CONFIG_EMULADOR_DEFECTO);
        assert.deepEqual(CONFIG_EMULADOR_DEFECTO, {host: "localhost:8085", proyecto: "meteored-local", pushHost: "host.docker.internal"});
    });

    it("el fichero gana al valor por defecto", () => {
        assert.deepEqual(resolverConfigEmulador({env: {}, fichero: {host: "otro:9000", pushHost: "172.17.0.1"}}), {
            host: "otro:9000",
            proyecto: "meteored-local",
            pushHost: "172.17.0.1",
        });
    });

    it("el entorno gana al fichero, variable a variable", () => {
        assert.deepEqual(resolverConfigEmulador({
            env: {PUBSUB_EMULATOR_HOST: "env:1", PUBSUB_PROJECT_ID: "proyecto-env", MRPACK_PUBSUB_PUSH_HOST: "push-env"},
            fichero: {host: "fichero:2", proyecto: "proyecto-fichero", pushHost: "push-fichero"},
        }), {host: "env:1", proyecto: "proyecto-env", pushHost: "push-env"});
        assert.deepEqual(resolverConfigEmulador({
            env: {PUBSUB_PROJECT_ID: "proyecto-env"},
            fichero: {host: "fichero:2", proyecto: "proyecto-fichero"},
        }), {host: "fichero:2", proyecto: "proyecto-env", pushHost: "host.docker.internal"});
    });

    it("una cadena vacía cuenta como ausente", () => {
        assert.deepEqual(resolverConfigEmulador({
            env: {PUBSUB_EMULATOR_HOST: "", PUBSUB_PROJECT_ID: "", MRPACK_PUBSUB_PUSH_HOST: ""},
            fichero: {host: "fichero:2", proyecto: "", pushHost: ""},
        }), {host: "fichero:2", proyecto: "meteored-local", pushHost: "host.docker.internal"});
    });
});

describe("leerConfigEmulador", () => {
    let raiz: string;

    beforeEach(async () => {
        raiz = await mkdtemp(path.join(os.tmpdir(), "mrpack-config-"));
    });

    afterEach(async () => {
        await rm(raiz, {recursive: true, force: true});
    });

    it("devuelve undefined si no existe config.workspaces.json", async () => {
        assert.equal(await leerConfigEmulador(raiz), undefined);
    });

    it("devuelve undefined si el fichero no tiene el bloque pubsub", async () => {
        await writeFile(path.join(raiz, "config.workspaces.json"), JSON.stringify({workspaces: {}}));
        assert.equal(await leerConfigEmulador(raiz), undefined);
    });

    it("devuelve el bloque pubsub, solo con las claves que conoce", async () => {
        await writeFile(path.join(raiz, "config.workspaces.json"), JSON.stringify({workspaces: {}, pubsub: {host: "otro:1", pushHost: "h", otra: true}}));
        assert.deepEqual(await leerConfigEmulador(raiz), {host: "otro:1", pushHost: "h"});
    });

    it("falla si una clave no es una cadena", async () => {
        await writeFile(path.join(raiz, "config.workspaces.json"), JSON.stringify({pubsub: {host: 8085}}));
        await assert.rejects(() => leerConfigEmulador(raiz), /pubsub\.host.*cadena/);
    });

    it("falla si pubsub no es un objeto", async () => {
        await writeFile(path.join(raiz, "config.workspaces.json"), JSON.stringify({pubsub: "localhost:8085"}));
        await assert.rejects(() => leerConfigEmulador(raiz), /"pubsub" debe ser un objeto/);
    });

    it("falla si el fichero no es JSON", async () => {
        await writeFile(path.join(raiz, "config.workspaces.json"), "{no es json");
        await assert.rejects(() => leerConfigEmulador(raiz), /no es un JSON válido/);
    });
});

describe("buscarDeclaraciones", () => {
    let raiz: string;

    const crear = async (workspace: string, {paquete = true, declaracion = true}: {paquete?: boolean; declaracion?: boolean} = {}): Promise<void> => {
        const directorio = path.join(raiz, workspace);
        await mkdir(directorio, {recursive: true});
        if (paquete) {
            await writeFile(path.join(directorio, "package.json"), "{}");
        }
        if (declaracion) {
            await writeFile(path.join(directorio, "mrpack.pubsub.ts"), "export default {};");
        }
    };

    beforeEach(async () => {
        raiz = await mkdtemp(path.join(os.tmpdir(), "mrpack-descubrir-"));
    });

    afterEach(async () => {
        await rm(raiz, {recursive: true, force: true});
    });

    it("encuentra los workspaces con declaración, ordenados, expandiendo patrones de uno y varios segmentos", async () => {
        await writeFile(path.join(raiz, "package.json"), JSON.stringify({workspaces: ["@mr/core/*", "services/*", "packages/exacto", "no/existe", "vacio/*"]}));
        await crear("services/zeta");
        await crear("services/alfa");
        await crear("services/sin-declaracion", {declaracion: false});
        await crear("services/sin-paquete", {paquete: false});
        await crear("@mr/core/dev");
        await crear("packages/exacto");
        await crear("packages/no-listado");
        await writeFile(path.join(raiz, "services", "fichero-suelto.txt"), "no es un directorio");

        assert.deepEqual(await buscarDeclaraciones(raiz), ["@mr/core/dev", "packages/exacto", "services/alfa", "services/zeta"]);
    });

    it("acepta workspaces como objeto {packages}", async () => {
        await writeFile(path.join(raiz, "package.json"), JSON.stringify({workspaces: {packages: ["services/*"]}}));
        await crear("services/a");
        assert.deepEqual(await buscarDeclaraciones(raiz), ["services/a"]);
    });

    it("admite comodines dentro del último segmento y patrones con ./ y / finales", async () => {
        await writeFile(path.join(raiz, "package.json"), JSON.stringify({workspaces: ["./services-*/", "otros"]}));
        await crear("services-uno");
        await crear("services-dos");
        await crear("servicios");
        await crear("otros");
        assert.deepEqual(await buscarDeclaraciones(raiz), ["otros", "services-dos", "services-uno"]);
    });

    it("excluye los patrones que empiezan por !", async () => {
        await writeFile(path.join(raiz, "package.json"), JSON.stringify({workspaces: ["services/*", "!services/b"]}));
        await crear("services/a");
        await crear("services/b");
        assert.deepEqual(await buscarDeclaraciones(raiz), ["services/a"]);
    });

    it("no devuelve nada si el package.json no tiene workspaces", async () => {
        await writeFile(path.join(raiz, "package.json"), JSON.stringify({name: "x"}));
        assert.deepEqual(await buscarDeclaraciones(raiz), []);
    });

    it("falla si workspaces no es una lista de patrones", async () => {
        await writeFile(path.join(raiz, "package.json"), JSON.stringify({workspaces: [1, 2]}));
        await assert.rejects(() => buscarDeclaraciones(raiz), /"workspaces" debe ser una lista/);
    });

    it("falla si no hay package.json en la raíz", async () => {
        await assert.rejects(() => buscarDeclaraciones(raiz));
    });
});

const decodificar = (valor: string): string => {
    try {
        return decodeURIComponent(valor);
    } catch {
        return valor;
    }
};

/**
 * Suscripción tal y como la guarda el emulador falso: lo que llegó en el PUT más lo que el emulador real rellena.
 */
interface ISuscripcionFalsa {
    topic: string;
    filter?: string;
    pushConfig: {pushEndpoint?: string};
    ackDeadlineSeconds?: number;
    labels?: Record<string, string>;
}

/**
 * Emulador de Pub/Sub en memoria, con la parte de la API REST que usa {@link EmuladorPubSub}: crear, leer, listar con
 * paginación, borrar, `modifyPushConfig` y publicar. Apunta cada petición en `peticiones` (con el nombre decodificado) y
 * la ruta tal como llegó por el cable en `rutas`.
 *
 * `antesDePut` se llama al recibir un `PUT` de una suscripción, antes de comprobar si existe: un test lo usa para
 * crearla justo entonces y simular a otro proceso que se adelanta (el emulador responde 409). Un `GET` de una
 * suscripción en `ocultas` responde 404, como si otro proceso la hubiera borrado de nuevo.
 */
class EmuladorFalso {
    public readonly topics: Map<string, {labels?: Record<string, string>}>;
    public readonly suscripciones: Map<string, ISuscripcionFalsa>;
    public readonly peticiones: string[];
    public readonly rutas: string[];
    public readonly ocultas: Set<string>;
    public readonly publicados: unknown[];
    public antesDePut: ((nombre: string) => void) | undefined;
    private readonly servidor: http.Server;

    public constructor() {
        this.topics = new Map();
        this.suscripciones = new Map();
        this.peticiones = [];
        this.rutas = [];
        this.ocultas = new Set();
        this.publicados = [];
        this.antesDePut = undefined;
        this.servidor = http.createServer((req, res) => {
            const trozos: Buffer[] = [];
            req.on("data", (trozo: Buffer) => trozos.push(trozo));
            req.on("end", () => {
                const cuerpo = trozos.length > 0 ? JSON.parse(Buffer.concat(trozos).toString("utf8")) as Record<string, unknown> : undefined;
                const [estado, salida] = this.atender(req.method ?? "GET", req.url ?? "/", cuerpo);
                res.writeHead(estado, {"Content-Type": "application/json"});
                res.end(typeof salida === "string" ? salida : JSON.stringify(salida));
            });
        });
    }

    public get host(): string {
        return `127.0.0.1:${(this.servidor.address() as AddressInfo).port}`;
    }

    public async iniciar(): Promise<void> {
        await new Promise<void>((resolve) => this.servidor.listen(0, "127.0.0.1", resolve));
    }

    public async parar(): Promise<void> {
        await new Promise<void>((resolve) => this.servidor.close(() => resolve()));
    }

    public escrituras(): string[] {
        return this.peticiones.filter((peticion) => !peticion.startsWith("GET "));
    }

    private pagina<T>(todos: T[], url: URL): {pagina: T[]; siguiente?: string} {
        const desde = Number(url.searchParams.get("pageToken") ?? 0);
        const pagina = todos.slice(desde, desde + 2);
        return {pagina, ...(desde + 2 < todos.length ? {siguiente: String(desde + 2)} : {})};
    }

    private atender(metodo: string, ruta: string, cuerpo: Record<string, unknown> | undefined): [number, unknown] {
        const url = new URL(ruta, "http://falso");
        const partes = url.pathname.split("/");
        const coleccion = partes[4] ?? "";
        const nombre = decodificar(partes.slice(5).join("/"));
        this.peticiones.push(`${metodo} ${coleccion}${nombre !== "" ? `/${nombre}` : ""}`);
        this.rutas.push(`${metodo} ${partes.slice(4).join("/")}`);

        if (url.pathname === "/") {
            return [200, "Ok"];
        }
        if (metodo === "GET" && nombre === "") {
            const todos = coleccion === "topics" ? [...this.topics.entries()].map(([n, t]) => ({name: `projects/p/topics/${n}`, ...t})) : [...this.suscripciones.entries()].map(([n, s]) => ({...s, name: `projects/p/subscriptions/${n}`, topic: `projects/p/topics/${s.topic}`}));
            const {pagina, siguiente} = this.pagina(todos, url);
            return [200, {[coleccion === "topics" ? "topics" : "subscriptions"]: pagina, ...(siguiente !== undefined ? {nextPageToken: siguiente} : {})}];
        }
        if (nombre.endsWith(":publish")) {
            this.publicados.push(cuerpo);
            return [200, {messageIds: ["7"]}];
        }
        if (nombre.endsWith(":modifyPushConfig")) {
            const suscripcion = this.suscripciones.get(nombre.slice(0, -":modifyPushConfig".length));
            if (suscripcion === undefined) {
                return [404, {error: {message: "Subscription does not exist"}}];
            }
            suscripcion.pushConfig = (cuerpo?.["pushConfig"] ?? {}) as ISuscripcionFalsa["pushConfig"];
            return [200, {}];
        }

        const almacen = coleccion === "topics" ? this.topics : this.suscripciones;
        if (metodo === "GET") {
            const suscripcion = this.suscripciones.get(nombre);
            if (coleccion !== "subscriptions" || suscripcion === undefined || this.ocultas.has(nombre)) {
                return [404, {error: {message: "does not exist"}}];
            }
            return [200, {...suscripcion, name: `projects/p/subscriptions/${nombre}`, topic: `projects/p/topics/${suscripcion.topic}`}];
        }
        if (metodo === "PUT") {
            if (coleccion === "subscriptions") {
                this.antesDePut?.(nombre);
            }
            if (almacen.has(nombre)) {
                return [409, {error: {message: "already exists"}}];
            }
            if (coleccion === "topics") {
                this.topics.set(nombre, {labels: cuerpo?.["labels"] as Record<string, string> | undefined});
            } else {
                const topic = String(cuerpo?.["topic"]).split("/").pop() ?? "";
                if (!this.topics.has(topic)) {
                    return [404, {error: {message: "Topic not found"}}];
                }
                this.suscripciones.set(nombre, {
                    topic,
                    filter: cuerpo?.["filter"] as string | undefined,
                    pushConfig: (cuerpo?.["pushConfig"] ?? {}) as ISuscripcionFalsa["pushConfig"],
                    ackDeadlineSeconds: (cuerpo?.["ackDeadlineSeconds"] as number | undefined) ?? 10,
                    labels: cuerpo?.["labels"] as Record<string, string> | undefined,
                });
            }
            return [200, {}];
        }
        if (metodo === "DELETE") {
            return almacen.delete(nombre) ? [200, {}] : [404, {error: {message: "does not exist"}}];
        }
        return [400, {error: {message: "no soportado"}}];
    }
}

describe("EmuladorPubSub", () => {
    const REPO = "mi-repo";
    const REPO_SUCIO = "Mi Repo/x";
    let falso: EmuladorFalso;
    let emulador: EmuladorPubSub;

    const topologia = (extra: Partial<ISuscripcionDeclarada> = {}) => fusionar([
        {workspace: "packages/base", declaracion: {topics: ["topic-uno"]}},
        {workspace: "services/a", declaracion: {suscripciones: [
            {nombre: "sub-push", topic: "topic-uno", filtro: 'attributes.x = "a"', push: {base: "http://localhost:17073"}, ackDeadline: 120, ...extra},
            {nombre: "sub-pull", topic: "topic-ajeno"},
        ]}},
    ]);

    before(async () => {
        falso = new EmuladorFalso();
        await falso.iniciar();
        emulador = EmuladorPubSub.build({host: falso.host, proyecto: "p", pushHost: "host.docker.internal"});
    });

    after(async () => {
        await falso.parar();
    });

    beforeEach(() => {
        falso.topics.clear();
        falso.suscripciones.clear();
        falso.peticiones.length = 0;
        falso.rutas.length = 0;
        falso.publicados.length = 0;
        falso.ocultas.clear();
        falso.antesDePut = undefined;
    });

    it("expone las variables de entorno que apuntan a él", () => {
        assert.deepEqual(emulador.entorno, {PUBSUB_EMULATOR_HOST: falso.host, PUBSUB_PROJECT_ID: "p"});
        assert.equal(emulador.config.proyecto, "p");
    });

    it("disponible solo si GET / devuelve Ok", async () => {
        assert.equal(await emulador.disponible(), true);
        assert.equal(await EmuladorPubSub.build({host: "127.0.0.1:1", proyecto: "p", pushHost: "h"}).disponible(), false);
    });

    it("mensajeEmuladorCaido nombra el host y el servicio de mrenv", () => {
        assert.equal(mensajeEmuladorCaido("localhost:8085"), "No se ha encontrado levantado el docker de Pub/Sub en localhost:8085 (servicio `pubsub` de mrenv). Levántalo y vuelve a lanzar.");
    });

    it("aplicar crea topics y suscripciones con sus labels y su configuración", async () => {
        const informe = await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});

        assert.deepEqual(informe.recursos.map(({tipo, nombre, workspace, accion}) => [tipo, nombre, workspace, accion]), [
            ["topic", "topic-ajeno", "(deducido)", "creado"],
            ["topic", "topic-uno", "packages/base", "creado"],
            ["suscripcion", "sub-pull", "services/a", "creado"],
            ["suscripcion", "sub-push", "services/a", "creado"],
        ]);
        assert.deepEqual(falso.topics.get("topic-uno")?.labels, {"mrpack-repo": "mi-repo", "mrpack-workspace": "packages_base"});
        assert.equal(falso.topics.get("topic-ajeno")?.labels, undefined, "un topic deducido se crea sin label de repo: puede ser de otro");
        assert.deepEqual(falso.suscripciones.get("sub-push"), {
            topic: "topic-uno",
            filter: 'attributes.x = "a"',
            pushConfig: {pushEndpoint: "http://host.docker.internal:17073/"},
            ackDeadlineSeconds: 120,
            labels: {"mrpack-repo": "mi-repo", "mrpack-workspace": "services_a"},
        });
        assert.deepEqual(falso.suscripciones.get("sub-pull")?.pushConfig, {});
    });

    it("aplicar informa de todos los workspaces que declaran un topic", async () => {
        const varios = fusionar([
            {workspace: "services/b", declaracion: {topics: ["topic-uno"]}},
            {workspace: "packages/base", declaracion: {topics: ["topic-uno"]}},
        ]);
        const informe = await emulador.aplicar(varios, {modo: "arranque", repo: REPO});

        assert.equal(informe.recursos[0]?.workspace, "packages/base, services/b");
        assert.deepEqual(falso.topics.get("topic-uno")?.labels, {"mrpack-repo": "mi-repo", "mrpack-workspace": "packages_base"});
    });

    it("aplicar es idempotente: la segunda vez no escribe nada", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        falso.peticiones.length = 0;
        const informe = await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});

        assert.ok(informe.recursos.every(({accion}) => accion === "existia"));
        assert.deepEqual(falso.escrituras().filter((peticion) => !peticion.startsWith("PUT topics/")), []);
    });

    describe("409 al crear una suscripción (otro proceso se adelantó)", () => {
        const declarada = (ackDeadlineSeconds = 120): ISuscripcionFalsa => ({
            topic: "topic-uno",
            filter: 'attributes.x = "a"',
            pushConfig: {pushEndpoint: "http://host.docker.internal:17073/"},
            ackDeadlineSeconds,
            labels: {"mrpack-repo": "mi-repo", "mrpack-workspace": "services_a"},
        });
        const seAdelanta = (nombre: string, suscripcion: ISuscripcionFalsa): void => {
            falso.antesDePut = (puesta) => {
                if (puesta === nombre) {
                    falso.antesDePut = undefined;
                    falso.suscripciones.set(nombre, suscripcion);
                }
            };
        };

        it("aplicar: si lo que se encontró es igual, la da por existente sin recrearla", async () => {
            seAdelanta("sub-push", declarada());
            const informe = await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});

            assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-push")?.accion, "existia");
            assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-pull")?.accion, "creado");
            assert.deepEqual(falso.escrituras().filter((peticion) => peticion.includes("sub-push")), ["PUT subscriptions/sub-push"]);
            assert.ok(falso.peticiones.includes("GET subscriptions/sub-push"), "vuelve a leerla");
        });

        it("aplicar: si lo que se encontró difiere, lo informa sin tocarlo", async () => {
            seAdelanta("sub-push", declarada(300));
            const informe = await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});

            const recurso = informe.recursos.find(({nombre}) => nombre === "sub-push");
            assert.equal(recurso?.accion, "difiere");
            assert.match(recurso?.detalle ?? "", /ackDeadline: 300 -> 120/);
            assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 300);
            assert.deepEqual(falso.escrituras().filter((peticion) => peticion.includes("sub-push")), ["PUT subscriptions/sub-push"]);
        });

        it("aplicar: también al recrear una suscripción que difería", async () => {
            await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
            falso.peticiones.length = 0;
            seAdelanta("sub-push", declarada(300));
            const informe = await emulador.aplicar(topologia({ackDeadline: 300}), {modo: "arranque", repo: REPO});

            assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-push")?.accion, "existia");
            assert.deepEqual(falso.escrituras().filter((peticion) => peticion.includes("sub-push")), ["DELETE subscriptions/sub-push", "PUT subscriptions/sub-push"]);
            assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 300);
        });

        it("aplicar: si tras el 409 ya no existe, falla diciéndolo", async () => {
            seAdelanta("sub-push", declarada());
            falso.ocultas.add("sub-push");
            await assert.rejects(() => emulador.aplicar(topologia(), {modo: "arranque", repo: REPO}), /PUT subscriptions\/sub-push.*409.*ya no existe/);
        });

        it("purgar: un 409 tras el DELETE se da por bueno", async () => {
            await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
            seAdelanta("sub-push", declarada());
            await emulador.purgar(topologia().suscripciones.filter(({nombre}) => nombre === "sub-push"), {repo: REPO});

            assert.ok(falso.suscripciones.has("sub-push"));
            assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 120);
        });
    });

    describe("suscripciones de otro repo", () => {
        const otroRepo = async (): Promise<void> => {
            await emulador.aplicar(topologia(), {modo: "arranque", repo: "otro-repo"});
            falso.peticiones.length = 0;
        };

        it("en arranque, un push distinto no se modifica: se informa con el repo dueño", async () => {
            await otroRepo();
            const informe = await emulador.aplicar(topologia({push: {base: "http://localhost:17999"}}), {modo: "arranque", repo: REPO});

            const recurso = informe.recursos.find(({nombre}) => nombre === "sub-push");
            assert.equal(recurso?.accion, "difiere");
            assert.match(recurso?.detalle ?? "", /^declarada también por el repo otro-repo: /);
            assert.match(recurso?.detalle ?? "", /push: /);
            assert.equal(falso.suscripciones.get("sub-push")?.pushConfig.pushEndpoint, "http://host.docker.internal:17073/");
            assert.ok(!falso.peticiones.some((peticion) => peticion.startsWith("DELETE ") || peticion.includes("modifyPushConfig")));
        });

        it("en arranque, un filtro o un ackDeadline distintos no la recrean", async () => {
            await otroRepo();
            const informe = await emulador.aplicar(topologia({filtro: 'attributes.x = "b"', ackDeadline: 300}), {modo: "arranque", repo: REPO});

            assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-push")?.accion, "difiere");
            assert.match(informe.recursos.find(({nombre}) => nombre === "sub-push")?.detalle ?? "", /declarada también por el repo otro-repo: .*ackDeadline: 120 -> 300/);
            assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 120);
            assert.deepEqual(falso.escrituras().filter((peticion) => peticion.includes("sub-")), []);
            assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-pull")?.accion, "existia");
        });

        it("las que no llevan label siguen corrigiéndose como siempre", async () => {
            await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
            delete falso.suscripciones.get("sub-push")!.labels;
            const informe = await emulador.aplicar(topologia({ackDeadline: 300}), {modo: "arranque", repo: REPO});

            assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-push")?.accion, "recreado");
            assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 300);
        });

        it("si son iguales, no hay nada que informar aunque sean de otro repo", async () => {
            await otroRepo();
            const informe = await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});

            assert.ok(informe.recursos.every(({accion}) => accion === "existia"));
        });
    });

    it("un topic deducido se crea sin label y limpiar de ese repo no lo borra", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        const sinSubPull = fusionar([
            {workspace: "packages/base", declaracion: {topics: ["topic-uno"]}},
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub-push", topic: "topic-uno"}]}},
        ]);

        const borrado = await emulador.limpiar(sinSubPull, {repo: REPO});

        assert.deepEqual(borrado, ["suscripcion sub-pull"]);
        assert.ok(falso.topics.has("topic-ajeno"));
        assert.ok(falso.topics.has("topic-uno"));
    });

    it("los nombres van codificados en la ruta", async () => {
        const rara = fusionar([
            {workspace: "packages/base", declaracion: {topics: ["topic+x%y"]}},
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub+x%y", topic: "topic+x%y", push: {base: "http://localhost:17073"}}]}},
        ]);
        await emulador.aplicar(rara, {modo: "arranque", repo: REPO});
        await emulador.aplicar({...rara, suscripciones: rara.suscripciones.map((suscripcion) => ({...suscripcion, push: {base: "http://localhost:17999"}}))}, {modo: "arranque", repo: REPO});
        await emulador.purgar(rara.suscripciones, {repo: REPO});
        await emulador.publicar("topic+x%y", {a: 1});
        await emulador.limpiar({topics: [], suscripciones: []}, {repo: REPO});

        assert.ok(falso.rutas.includes("PUT topics/topic%2Bx%25y"));
        assert.ok(falso.rutas.includes("PUT subscriptions/sub%2Bx%25y"));
        assert.ok(falso.rutas.includes("POST subscriptions/sub%2Bx%25y:modifyPushConfig"));
        assert.ok(falso.rutas.includes("DELETE subscriptions/sub%2Bx%25y"));
        assert.ok(falso.rutas.includes("POST topics/topic%2Bx%25y:publish"));
        assert.ok(falso.rutas.includes("DELETE topics/topic%2Bx%25y"));
        assert.equal(falso.publicados.length, 1);
        assert.equal(falso.topics.size, 0);
    });

    it("en arranque, un push distinto se modifica sin recrear la suscripción", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        falso.peticiones.length = 0;
        const informe = await emulador.aplicar(topologia({push: {base: "http://localhost:17999"}}), {modo: "arranque", repo: REPO});

        const recurso = informe.recursos.find(({nombre}) => nombre === "sub-push");
        assert.equal(recurso?.accion, "push-actualizado");
        assert.match(recurso?.detalle ?? "", /push: http:\/\/host\.docker\.internal:17073\/ -> http:\/\/host\.docker\.internal:17999\//);
        assert.equal(falso.suscripciones.get("sub-push")?.pushConfig.pushEndpoint, "http://host.docker.internal:17999/");
        assert.ok(falso.peticiones.includes("POST subscriptions/sub-push:modifyPushConfig"));
        assert.ok(!falso.peticiones.some((peticion) => peticion.startsWith("DELETE ")));
    });

    it("en arranque, quitar el push deja la suscripción como pull", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        await emulador.aplicar(topologia({push: undefined}), {modo: "arranque", repo: REPO});

        assert.deepEqual(falso.suscripciones.get("sub-push")?.pushConfig, {});
    });

    it("en arranque, un filtro o un ackDeadline distintos recrean la suscripción", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        falso.peticiones.length = 0;
        const informe = await emulador.aplicar(topologia({filtro: 'attributes.x = "b"', ackDeadline: 300}), {modo: "arranque", repo: REPO});

        const recurso = informe.recursos.find(({nombre}) => nombre === "sub-push");
        assert.equal(recurso?.accion, "recreado");
        assert.match(recurso?.detalle ?? "", /filtro/);
        assert.match(recurso?.detalle ?? "", /ackDeadline: 120 -> 300/);
        assert.deepEqual(falso.escrituras().filter((peticion) => peticion.includes("sub-push")), ["DELETE subscriptions/sub-push", "PUT subscriptions/sub-push"]);
        assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 300);
    });

    it("en vigilancia solo crea lo que falta y las diferencias las informa sin tocarlas", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        falso.suscripciones.delete("sub-pull");
        falso.peticiones.length = 0;
        const informe = await emulador.aplicar(topologia({push: {base: "http://localhost:17999"}, ackDeadline: 300}), {modo: "vigilancia", repo: REPO});

        assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-push")?.accion, "difiere");
        assert.match(informe.recursos.find(({nombre}) => nombre === "sub-push")?.detalle ?? "", /ackDeadline: 120 -> 300/);
        assert.equal(informe.recursos.find(({nombre}) => nombre === "sub-pull")?.accion, "creado");
        assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 120);
        assert.equal(falso.suscripciones.get("sub-push")?.pushConfig.pushEndpoint, "http://host.docker.internal:17073/");
        assert.ok(!falso.peticiones.some((peticion) => peticion.startsWith("DELETE ") || peticion.includes("modifyPushConfig")));
    });

    it("nunca toca recursos que no están en la topología", async () => {
        falso.topics.set("topic-ajeno-sin-label", {});
        falso.suscripciones.set("sub-ajena", {topic: "topic-ajeno-sin-label", pushConfig: {}, ackDeadlineSeconds: 10});
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});

        assert.ok(falso.topics.has("topic-ajeno-sin-label"));
        assert.ok(falso.suscripciones.has("sub-ajena"));
        assert.ok(!falso.escrituras().some((peticion) => peticion.includes("sub-ajena") || peticion.includes("topic-ajeno-sin-label")));
    });

    it("el repo y el workspace de las labels se sanean", async () => {
        const larga = `Mi Repo/${"x".repeat(80)}`;
        await emulador.aplicar(topologia(), {modo: "arranque", repo: larga});

        const labels = falso.topics.get("topic-uno")?.labels;
        assert.equal(labels?.["mrpack-repo"], `mi_repo_${"x".repeat(55)}`);
        assert.equal(labels?.["mrpack-repo"].length, 63);
    });

    it("listar recorre todas las páginas", async () => {
        for (const nombre of ["t1", "t2", "t3", "t4", "t5"]) {
            falso.topics.set(nombre, {});
        }
        for (const nombre of ["s1", "s2", "s3"]) {
            falso.suscripciones.set(nombre, {topic: "t1", pushConfig: {}, ackDeadlineSeconds: 10});
        }
        falso.suscripciones.set("s4", {topic: "t1", pushConfig: {}});
        const todo = await emulador.listar();

        assert.deepEqual(todo.topics, ["t1", "t2", "t3", "t4", "t5"]);
        assert.deepEqual(todo.suscripciones.map(({nombre}) => nombre), ["s1", "s2", "s3", "s4"]);
        assert.equal(todo.suscripciones[0]?.topic, "t1");
        assert.equal(todo.suscripciones[0]?.ackDeadline, 10);
        assert.equal(todo.suscripciones[3]?.ackDeadline, 10, "sin ackDeadlineSeconds, el 10 por defecto");
    });

    it("estado distingue ok, falta y difiere, y lista los extras con su dueño", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO_SUCIO});
        falso.topics.delete("topic-ajeno");
        falso.suscripciones.delete("sub-pull");
        falso.suscripciones.get("sub-push")!.ackDeadlineSeconds = 30;
        falso.topics.set("topic-de-otro", {labels: {"mrpack-repo": "otro-repo"}});
        falso.topics.set("topic-propio-viejo", {labels: {"mrpack-repo": "mi_repo_x"}});
        falso.topics.set("topic-sin-label", {});
        const informe = await emulador.estado(topologia(), {repo: REPO_SUCIO});

        assert.deepEqual(informe.recursos.map(({nombre, estado}) => [nombre, estado]), [
            ["topic-ajeno", "falta"],
            ["topic-uno", "ok"],
            ["sub-pull", "falta"],
            ["sub-push", "difiere"],
        ]);
        assert.match(informe.recursos[3]?.detalle ?? "", /ackDeadline: 30 -> 120/);
        assert.deepEqual(informe.extras, [
            {tipo: "topic", nombre: "topic-de-otro", repo: "otro-repo", propio: false},
            {tipo: "topic", nombre: "topic-propio-viejo", repo: "mi_repo_x", propio: true},
            {tipo: "topic", nombre: "topic-sin-label", propio: false},
        ]);
    });

    it("estado no escribe nada", async () => {
        await emulador.estado(topologia(), {repo: REPO});
        assert.deepEqual(falso.escrituras(), []);
    });

    it("purgar borra y recrea solo las suscripciones que se le pasan", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        falso.peticiones.length = 0;
        await emulador.purgar(topologia().suscripciones.filter(({nombre}) => nombre === "sub-push"), {repo: REPO});

        assert.deepEqual(falso.escrituras(), ["DELETE subscriptions/sub-push", "PUT subscriptions/sub-push"]);
        assert.equal(falso.suscripciones.get("sub-push")?.ackDeadlineSeconds, 120);
        assert.equal(falso.suscripciones.get("sub-push")?.pushConfig.pushEndpoint, "http://host.docker.internal:17073/");
    });

    it("purgar no falla si la suscripción no existía", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        falso.suscripciones.delete("sub-push");
        await emulador.purgar(topologia().suscripciones.filter(({nombre}) => nombre === "sub-push"), {repo: REPO});

        assert.ok(falso.suscripciones.has("sub-push"));
    });

    it("limpiar solo borra lo que lleva la label de este repo y ya no está declarado", async () => {
        const vigente = fusionar([
            {workspace: "packages/base", declaracion: {topics: ["topic-uno", "topic-declarado-sin-subs"]}},
            {workspace: "services/a", declaracion: {suscripciones: [{nombre: "sub-push", topic: "topic-uno"}]}},
        ]);
        await emulador.aplicar(vigente, {modo: "arranque", repo: REPO_SUCIO});
        const propia = {"mrpack-repo": "mi_repo_x"};
        const ajena = {"mrpack-repo": "otro-repo"};
        falso.topics.set("topic-propio-viejo", {labels: propia});
        falso.topics.set("topic-propio-con-sub-ajena", {labels: propia});
        falso.topics.set("topic-de-otro", {labels: ajena});
        falso.topics.set("topic-de-otro-con-sub-propia", {labels: ajena});
        falso.topics.set("topic-sin-label", {});
        falso.suscripciones.set("sub-propia-vieja", {topic: "topic-propio-viejo", pushConfig: {}, ackDeadlineSeconds: 10, labels: propia});
        falso.suscripciones.set("sub-ajena-en-topic-propio", {topic: "topic-propio-con-sub-ajena", pushConfig: {}, ackDeadlineSeconds: 10, labels: ajena});
        falso.suscripciones.set("sub-propia-en-topic-ajeno", {topic: "topic-de-otro-con-sub-propia", pushConfig: {}, ackDeadlineSeconds: 10, labels: propia});
        falso.suscripciones.set("sub-sin-label", {topic: "topic-sin-label", pushConfig: {}, ackDeadlineSeconds: 10});

        const borrado = await emulador.limpiar(vigente, {repo: REPO_SUCIO});

        assert.deepEqual([...borrado].sort(), ["suscripcion sub-propia-en-topic-ajeno", "suscripcion sub-propia-vieja", "topic topic-propio-viejo"]);
        assert.ok(borrado.indexOf("topic topic-propio-viejo") > borrado.indexOf("suscripcion sub-propia-vieja"), "las suscripciones se borran antes que sus topics");
        assert.deepEqual([...falso.topics.keys()].sort(), ["topic-de-otro", "topic-de-otro-con-sub-propia", "topic-declarado-sin-subs", "topic-propio-con-sub-ajena", "topic-sin-label", "topic-uno"]);
        assert.deepEqual([...falso.suscripciones.keys()].sort(), ["sub-ajena-en-topic-propio", "sub-push", "sub-sin-label"]);
    });

    it("limpiar no borra los topics ajenos o sin label aunque no tengan suscripciones", async () => {
        const vigente = topologia();
        await emulador.aplicar(vigente, {modo: "arranque", repo: REPO});
        falso.topics.set("topic-de-otro-sin-subs", {labels: {"mrpack-repo": "otro-repo"}});
        falso.topics.set("topic-sin-label-sin-subs", {});

        assert.deepEqual(await emulador.limpiar(vigente, {repo: REPO}), []);
        assert.ok(falso.topics.has("topic-de-otro-sin-subs") && falso.topics.has("topic-sin-label-sin-subs"));
    });

    it("limpiar con la label de otro repo no borra nada", async () => {
        await emulador.aplicar(topologia(), {modo: "arranque", repo: REPO});
        const borrado = await emulador.limpiar({topics: [], suscripciones: []}, {repo: "repo-distinto"});

        assert.deepEqual(borrado, []);
        assert.deepEqual(falso.escrituras().filter((peticion) => peticion.startsWith("DELETE ")), []);
    });

    it("publicar manda el mensaje en base64 con sus atributos y devuelve el id", async () => {
        const id = await emulador.publicar("topic-uno", {hola: "mundo"}, {sender: "amateur"});

        assert.equal(id, "7");
        const [mensaje] = (falso.publicados[0] as {messages: {data: string; attributes?: Record<string, string>}[]}).messages;
        assert.deepEqual(JSON.parse(Buffer.from(mensaje?.data ?? "", "base64").toString("utf8")), {hola: "mundo"});
        assert.deepEqual(mensaje?.attributes, {sender: "amateur"});
    });

    it("un error HTTP lleva el método, el recurso, el estado y el cuerpo", async () => {
        await assert.rejects(() => emulador.purgar([{nombre: "sub-x", topic: "no-existe", consumidor: "services/a"}], {repo: REPO}), (err: Error) => {
            assert.match(err.message, /PUT subscriptions\/sub-x/);
            assert.match(err.message, /HTTP 404/);
            assert.match(err.message, /Topic not found/);
            return true;
        });
    });

    it("si el emulador no responde, el error lo dice con su host", async () => {
        const caido = EmuladorPubSub.build({host: "127.0.0.1:1", proyecto: "p", pushHost: "h"});
        await assert.rejects(() => caido.listar(), /GET topics.*127\.0\.0\.1:1.*no responde/);
    });
});
