/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 2258e4332190546952fd6bb4d0d15c28
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

import {after, before, describe, it, mock} from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawn} from "node:child_process";
import {setTimeout as sleep} from "node:timers/promises";
import assert from "node:assert/strict";

import {ClientOfflineError} from "redis";

import {Redis, type IRedisOptions} from "../../../modules/database/redis";
import {FakeResp} from "./fake-resp";

/**
 * Pruebas de `Redis` contra un servidor RESP falso (`fake-resp.ts`), en bucle local: sin Redis, sin servicios y sin tocar la red de nadie.
 *
 * Incluyen los escenarios que fallaban en el cliente anterior (que recreaba los clientes ante un error): una caída real dejaba el cliente
 * inservible y concedía locks sin Redis; una primera conexión fallida tiraba el proceso con un rechazo sin atender.
 */

const NAMESPACE = "meteored-spec";
const PREFIX = "mr-spec:servicio-spec:";

/**
 * Crea el cliente contra los servidores, ejecuta la prueba y lo libera siempre (si no, sus sockets mantendrían vivo el proceso de pruebas).
 *
 * @param servers Primarios, en orden.
 * @param options Opciones del cliente.
 * @param body Cuerpo de la prueba.
 * @param read Servidor de lectura, si lo hay.
 */
async function withRedis(servers: FakeResp[], options: IRedisOptions, body: (redis: Redis) => Promise<void>, read?: FakeResp): Promise<void> {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "redis-spec-"));
    const credentials = path.join(directory, "redis.json");
    const toNode = (server: FakeResp) => ({host: "127.0.0.1", port: String(server.port)});
    const content = servers.length === 1 && read === undefined
        ? toNode(servers[0])
        : {primary: servers.map(toNode), ...(read === undefined ? {} : {read: toNode(read)})};
    await fs.writeFile(credentials, JSON.stringify(content));

    const redis = Redis.build({pod: {servicio: "servicio-spec"}, credenciales: credentials, options});
    try {
        await body(redis);
    } finally {
        await redis[Symbol.asyncDispose]().catch(() => undefined); // si el clúster no se pudo crear, no hay nada que liberar
        await fs.rm(directory, {recursive: true, force: true});
    }
}

/**
 * Reintenta una comprobación hasta que se cumple o se agota el tiempo.
 */
async function waitUntil(condition: () => boolean | Promise<boolean>, message: string, maxMs = 3_000): Promise<void> {
    const limit = Date.now() + maxMs;
    while (!(await condition())) {
        if (Date.now() > limit) {
            assert.fail(`Se agotó el tiempo esperando: ${message}`);
        }
        await sleep(10);
    }
}

const BATCH = [{key: "contador", field: "a", increment: 1, ttl: 60}];

describe("Redis: opciones nuevas", () => {
    function create(options: IRedisOptions): Redis {
        return Redis.build({pod: {servicio: "x"}, credenciales: "no-importa.json", options});
    }

    it("rechaza al crear un singleNode que no sea un entero mayor o igual que 0", () => {
        for (const singleNode of [-1, 0.5, NaN, Infinity]) {
            assert.throws(() => create({singleNode}), RangeError, String(singleNode));
        }
    });

    it("rechaza al crear un logThrottleMs o una espera máxima absurdos", () => {
        for (const logThrottleMs of [-1, NaN, Infinity]) {
            assert.throws(() => create({logThrottleMs}), RangeError, `logThrottleMs ${logThrottleMs}`);
        }
        for (const maxReconnectDelayMs of [0, -5, NaN, Infinity]) {
            assert.throws(() => create({maxReconnectDelayMs}), RangeError, `maxReconnectDelayMs ${maxReconnectDelayMs}`);
        }
    });

    it("sin opciones, o con valores válidos, se crea sin tocar la red ni el disco", () => {
        assert.ok(create({}));
        assert.ok(create({singleNode: 2, logThrottleMs: 0, maxReconnectDelayMs: 1_000, connectOnBuild: false}));
        assert.ok(Redis.build({pod: {servicio: "x"}, credenciales: "no-importa.json"}));
    });
});

describe("Redis con servidor falso", () => {
    let server: FakeResp;
    let second: FakeResp;
    let previousNamespace: string | undefined;

    before(() => {
        previousNamespace = process.env["K8S_NAMESPACE"];
        process.env["K8S_NAMESPACE"] = NAMESPACE;
    });

    after(() => {
        if (previousNamespace === undefined) {
            delete process.env["K8S_NAMESPACE"];
        } else {
            process.env["K8S_NAMESPACE"] = previousNamespace;
        }
    });

    async function startServers(): Promise<void> {
        server = await FakeResp.start();
        second = await FakeResp.start();
    }

    async function stopServers(): Promise<void> {
        await server.stop();
        await second.stop();
    }

    describe("bulkHIncrBy", () => {
        it("escribe en el primer primario por defecto, nunca en los demás", async () => {
            await startServers();
            try {
                await withRedis([server, second], {}, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                });
                assert.equal(server.seen("HINCRBY").length, 1);
                assert.equal(server.seen("EXEC").length, 1);
                assert.equal(second.seen("HINCRBY").length, 0);
                assert.equal(second.seen("EXEC").length, 0);
            } finally {
                await stopServers();
            }
        });

        it("con singleNode escribe en ese nodo y solo en ese", async () => {
            await startServers();
            try {
                await withRedis([server, second], {singleNode: 1}, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                });
                assert.equal(server.seen("HINCRBY").length, 0);
                assert.equal(second.seen("HINCRBY").length, 1);
            } finally {
                await stopServers();
            }
        });

        it("aplica el namespace del servicio a las claves, salvo con shared", async () => {
            await startServers();
            try {
                await withRedis([server], {}, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    assert.equal(await redis.bulkHIncrBy(BATCH, {shared: true}), "ok");
                });
                assert.deepEqual(server.seen("HINCRBY").map(args => args[1]), [`${PREFIX}contador`, "contador"]);
                assert.deepEqual(server.seen("EXPIRE").map(args => args[1]), [`${PREFIX}contador`, "contador"]);
            } finally {
                await stopServers();
            }
        });

        it("todo el lote va en un MULTI: un HINCRBY por elemento y un solo EXPIRE por clave, con el mayor TTL", async () => {
            await startServers();
            try {
                await withRedis([server], {}, async redis => {
                    const result = await redis.bulkHIncrBy([
                        {key: "a", field: "f1", increment: 1, ttl: 60},
                        {key: "a", field: "f2", increment: -2, ttl: 300},
                        {key: "b", field: "f1", increment: 5, ttl: 30},
                    ], {shared: true});
                    assert.equal(result, "ok");
                });
                const transaction = server.commands.filter(args => ["MULTI", "HINCRBY", "EXPIRE", "EXEC"].includes(args[0].toUpperCase()));
                assert.deepEqual(transaction, [
                    ["MULTI"],
                    ["HINCRBY", "a", "f1", "1"],
                    ["HINCRBY", "a", "f2", "-2"],
                    ["HINCRBY", "b", "f1", "5"],
                    ["EXPIRE", "a", "300"],
                    ["EXPIRE", "b", "30"],
                    ["EXEC"],
                ]);
            } finally {
                await stopServers();
            }
        });

        it("un lote vacío es ok y no abre ninguna conexión; uno inválido rechaza con RangeError sin enviar nada", async () => {
            await startServers();
            try {
                await withRedis([server], {}, async redis => {
                    assert.equal(await redis.bulkHIncrBy([]), "ok");
                    await assert.rejects(redis.bulkHIncrBy([{key: "a", field: "f", increment: 0, ttl: 10}]), RangeError);
                    await assert.rejects(redis.bulkHIncrBy([{key: "a", field: "f", increment: 1, ttl: 0}]), RangeError);
                });
                assert.equal(server.connections, 0);
                assert.equal(server.commands.length, 0);
            } finally {
                await stopServers();
            }
        });

        it("con un singleNode fuera de rango no escribe en ningún nodo (`notSent`), en vez de caer al nodo 0", async () => {
            await startServers();
            try {
                await withRedis([server, second], {singleNode: 2}, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "notSent");
                });
                assert.equal(server.seen("HINCRBY").length, 0);
                assert.equal(second.seen("HINCRBY").length, 0);
            } finally {
                await stopServers();
            }
        });
    });

    describe("bulkHGetAll", () => {
        it("devuelve los hashes en crudo, en el orden pedido, y null si no existen o están vacíos", async () => {
            await startServers();
            try {
                const envelope = JSON.stringify({expires: 1, data: "y"});
                server.preloadHash(`${PREFIX}h1`, {a: "1", b: "2"});
                server.preloadHash(`${PREFIX}h2`, {x: envelope});
                server.preloadHash(`${PREFIX}vacio`, {});
                await withRedis([server], {}, async redis => {
                    const result = await redis.bulkHGetAll(["h2", "no-existe", "h1", "vacio"]);
                    assert.deepEqual(result, [{x: envelope}, null, {a: "1", b: "2"}, null]);
                });
            } finally {
                await stopServers();
            }
        });

        it("con shared no aplica el namespace; sin claves devuelve [] sin conectar", async () => {
            await startServers();
            try {
                server.preloadHash("compartido", {a: "1"});
                await withRedis([server], {}, async redis => {
                    assert.deepEqual(await redis.bulkHGetAll(["compartido"], {shared: true}), [{a: "1"}]);
                    assert.deepEqual(await redis.bulkHGetAll(["compartido"]), [null]);
                });
                const noKeys = await FakeResp.start();
                try {
                    await withRedis([noKeys], {}, async redis => {
                        assert.deepEqual(await redis.bulkHGetAll([]), []);
                    });
                    assert.equal(noKeys.connections, 0);
                } finally {
                    await noKeys.stop();
                }
            } finally {
                await stopServers();
            }
        });

        it("lee del nodo único por defecto y del de lectura si se pide", async () => {
            await startServers();
            try {
                server.preloadHash(`${PREFIX}h`, {origin: "single"});
                second.preloadHash(`${PREFIX}h`, {origin: "read"});
                await withRedis([server], {}, async redis => {
                    assert.deepEqual(await redis.bulkHGetAll(["h"]), [{origin: "single"}]);
                    assert.deepEqual(await redis.bulkHGetAll(["h"], {node: "read"}), [{origin: "read"}]);
                }, second);
            } finally {
                await stopServers();
            }
        });

        it("con un singleNode fuera de rango rechaza con RangeError, no lee del nodo 0", async () => {
            await startServers();
            try {
                server.preloadHash(`${PREFIX}h`, {a: "1"});
                await withRedis([server], {singleNode: 1}, async redis => {
                    await assert.rejects(redis.bulkHGetAll(["h"]), RangeError);
                });
                assert.equal(server.seen("HGETALL").length, 0);
            } finally {
                await stopServers();
            }
        });
    });

    describe("expire", () => {
        it("por defecto se aplica en todos los primarios, con el namespace", async () => {
            await startServers();
            try {
                await withRedis([server, second], {}, async redis => {
                    await redis.expire("clave", 120);
                    await redis.expire("clave", 120, {shared: true});
                });
                for (const each of [server, second]) {
                    assert.deepEqual(each.seen("EXPIRE"), [["EXPIRE", `${PREFIX}clave`, "120"], ["EXPIRE", "clave", "120"]]);
                }
            } finally {
                await stopServers();
            }
        });

        it("con `target: \"single\"` solo se aplica en el nodo único", async () => {
            await startServers();
            try {
                await withRedis([server, second], {singleNode: 1}, async redis => {
                    await redis.expire("clave", 30, {target: "single"});
                });
                assert.equal(server.seen("EXPIRE").length, 0);
                assert.deepEqual(second.seen("EXPIRE"), [["EXPIRE", `${PREFIX}clave`, "30"]]);
            } finally {
                await stopServers();
            }
        });

        it("rechaza un ttl que no sea un entero mayor que 0 (Redis borraría la clave), sin enviar nada", async () => {
            await startServers();
            try {
                await withRedis([server], {}, async redis => {
                    for (const ttl of [0, -1, 1.5, NaN]) {
                        await assert.rejects(redis.expire("clave", ttl), RangeError, String(ttl));
                    }
                });
                assert.equal(server.commands.length, 0);
            } finally {
                await stopServers();
            }
        });

        it("propaga los errores en vez de tragárselos", async () => {
            await startServers();
            try {
                await withRedis([server, second], {singleNode: 5}, async redis => {
                    await assert.rejects(redis.expire("clave", 30, {target: "single"}), RangeError);
                });
            } finally {
                await stopServers();
            }
        });
    });

    describe("con Redis caído o intermitente", () => {
        const FAST: IRedisOptions = {maxReconnectDelayMs: 100, logThrottleMs: 0};

        /**
         * Comprueba todos los métodos públicos con Redis sin conexión: lo que escribe «best-effort» registra y resuelve sin escribir, lo que lee
         * da `null` o `[]`, `aquireLock` no concede, y lo que propaga errores (`bulk*`, `bulkHGetAll`, `expire`) rechaza.
         */
        async function checkMethodsDown(redis: Redis, down: FakeResp): Promise<void> {
            const before = down.commands.length;

            // Escrituras best-effort: resuelven (no lanzan) y no escriben.
            await redis.set("k", Buffer.from("v"), {ttl: 5});
            await redis.hSet("h", "f", Buffer.from("v"));
            await redis.zAdd("z", "m", 1);
            await redis.saveJSON("k", {a: 1});
            await redis.saveHJSON("h", "f", {a: 1});
            await redis.saveZJSON("z", "m", 1);
            await redis.releaseLock(["l"], "id");

            // Lecturas: null o vacío, nunca un error ni un dato inventado.
            assert.equal(await redis.get("k"), null);
            assert.equal(await redis.get(["k", "j"]), null);
            assert.equal(await redis.hGet("h", "f"), null);
            assert.equal(await redis.hGetAll("h"), null);
            assert.equal(await redis.loadJSON("k"), null);
            assert.equal(await redis.loadJSON(["k", "j"]), null);
            assert.equal(await redis.loadHJSON("h"), null);
            assert.equal(await redis.loadHJSON("h", "f"), null);
            assert.deepEqual(await redis.searchKeys("*"), []);
            assert.equal(await redis.searchMaxScore("z"), null);

            // Locks: sin Redis no se concede nada (`null` es «error»; `""` sería «ya bloqueado»).
            assert.equal(await redis.aquireLock(["l"]), null);

            // Los que propagan errores rechazan.
            await assert.rejects(redis.bulkSet([{key: "k", value: "v", ttl: 10}]));
            await assert.rejects(redis.bulkHSet([{key: "k", field: "f", value: "v", ttl: 10}]));
            await redis.bulkHSet([]);
            assert.equal(await redis.bulkHIncrBy(BATCH), "notSent");
            await assert.rejects(redis.bulkHGetAll(["h"]));
            await assert.rejects(redis.expire("h", 10));
            await assert.rejects(redis.expire("h", 10, {target: "single"}));

            assert.equal(down.commands.length, before, "nada llega a un servidor caído");
        }

        it("caída real: cada método público conserva su contrato, y vuelve a funcionar solo cuando Redis vuelve", async () => {
            await startServers();
            try {
                await withRedis([server], FAST, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");

                    await server.stop();
                    await waitUntil(async () => (await redis.bulkHIncrBy(BATCH)) === "notSent", "que detecte la caída");
                    await checkMethodsDown(redis, server);

                    // Esperar varios intentos de reconexión no cambia nada: el cliente no se rinde ni se queda inservible.
                    await sleep(700);
                    await checkMethodsDown(redis, server);

                    await server.resume();
                    await waitUntil(async () => (await redis.bulkHIncrBy(BATCH)) === "ok", "que reconecte al volver");

                    await redis.set("tras-la-vuelta", Buffer.from("v"));
                    assert.ok(server.seen("SET").some(args => args[1] === `${PREFIX}tras-la-vuelta`));
                    assert.equal(typeof await redis.aquireLock(["lock"]), "string");
                    assert.ok(server.seen("EVAL").length >= 1);
                    await redis.bulkSet([{key: "k", value: "v", ttl: 10}]);
                    assert.deepEqual(await redis.bulkHGetAll(["contador"]), [{a: "2"}]);
                });
            } finally {
                await stopServers();
            }
        });

        it("Redis caído desde el principio: sin cola de errores sin atender, el proceso sigue vivo, cada método conserva su contrato y se recupera al volver", async () => {
            await startServers();
            const unhandled: unknown[] = [];
            const onUnhandled = (reason: unknown): void => {
                unhandled.push(reason);
            };
            process.on("unhandledRejection", onUnhandled);
            try {
                await server.stop();
                await withRedis([server], FAST, async redis => {
                    await checkMethodsDown(redis, server);

                    // El cliente anterior se rendía a los 3 reintentos (unos 600 ms) y, al hacerlo, dejaba un rechazo sin atender.
                    await sleep(1_500);
                    await checkMethodsDown(redis, server);
                    assert.deepEqual(unhandled, []);

                    await server.resume();
                    await waitUntil(async () => (await redis.bulkHIncrBy(BATCH)) === "ok", "que conecte cuando Redis aparezca");
                    await redis.set("tras-la-vuelta", Buffer.from("v"));
                    assert.ok(server.seen("SET").some(args => args[1] === `${PREFIX}tras-la-vuelta`));
                });
                await sleep(50);
                assert.deepEqual(unhandled, []);
            } finally {
                process.off("unhandledRejection", onUnhandled);
                await stopServers();
            }
        });

        it("con varios primarios, bulkHIncrBy, bulkHGetAll y expire con single solo tocan el primero", async () => {
            await startServers();
            const third = await FakeResp.start();
            try {
                server.preloadHash(`${PREFIX}h`, {a: "1"});
                await withRedis([server, second, third], FAST, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    assert.deepEqual(await redis.bulkHGetAll(["contador", "h"], {node: "single"}), [{a: "1"}, {a: "1"}]);
                    await redis.expire("contador", 30, {target: "single"});
                    await redis.expire("h", 30, {target: "single"});
                });
                for (const command of ["HINCRBY", "HGETALL", "EXPIRE", "EXEC", "MULTI"]) {
                    assert.ok(server.seen(command).length >= 1, `el primero recibe ${command}`);
                    assert.equal(second.seen(command).length, 0, `el segundo no recibe ${command}`);
                    assert.equal(third.seen(command).length, 0, `el tercero no recibe ${command}`);
                }
            } finally {
                await third.stop();
                await stopServers();
            }
        });

        it("con Redis caído, los avisos de los métodos salen una vez por tipo de error (y con la causa), y sin límite si se desactiva", async () => {
            await startServers();
            const warn = mock.method(console, "warn", () => undefined);
            try {
                await server.stop();
                await withRedis([server], {maxReconnectDelayMs: 100}, async redis => {
                    // La primera operación espera la ventana de gracia inicial; las demás ya fallan al instante.
                    await redis.get("k");
                    warn.mock.resetCalls();
                    for (let i = 0; i < 5; i++) {
                        await redis.get(`k${i}`);
                        await redis.set(`k${i}`, Buffer.from("v"));
                        await redis.hGetAll(`h${i}`);
                        await redis.aquireLock([`l${i}`]);
                    }
                    assert.equal(warn.mock.callCount(), 0, "el tipo ClientOfflineError ya se avisó en la primera operación");
                });
                warn.mock.resetCalls();
                await withRedis([server], {maxReconnectDelayMs: 100}, async redis => {
                    await redis.get("k");
                    const calls = warn.mock.calls;
                    assert.equal(calls.length, 1);
                    const failure = calls[0].arguments.find((argument: unknown) => argument instanceof Error) as Error; // `console.warn(prefijo, mensaje, error)`
                    assert.ok(failure.cause instanceof ClientOfflineError, "el error envuelto conserva la causa original");
                    assert.match(failure.message, /Causa:/);
                });

                warn.mock.resetCalls();
                await withRedis([server], {maxReconnectDelayMs: 100, logThrottleMs: 0}, async redis => {
                    await redis.get("k");
                    warn.mock.resetCalls();
                    for (let i = 0; i < 5; i++) {
                        await redis.get(`k${i}`);
                    }
                    assert.equal(warn.mock.callCount(), 5, "con logThrottleMs: 0 no se limita");
                });
            } finally {
                warn.mock.restore();
                await stopServers();
            }
        });

        it("parpadeo: se corta la conexión con el servidor aceptando, y el mismo cliente se recupera", async () => {
            await startServers();
            try {
                await withRedis([server], FAST, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    server.cut();
                    await waitUntil(async () => (await redis.bulkHIncrBy(BATCH)) === "ok", "que reconecte tras el corte");
                    await redis.set("tras-el-corte", Buffer.from("v"));
                    assert.ok(server.seen("SET").some(args => args[1] === `${PREFIX}tras-el-corte`));
                    assert.equal(server.connections, 2);
                });
            } finally {
                await stopServers();
            }
        });

        it("la primera operación tras construir el cliente espera a que conecte: no pierde el primer lote por arrancar un instante antes", async () => {
            await startServers();
            try {
                server.delayMs = 20;
                await withRedis([server], FAST, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH, {timeoutMs: 1_000}), "ok");
                });
            } finally {
                await stopServers();
            }
        });
    });

    describe("conexión y cierre", () => {
        const OPTIONS: IRedisOptions = {maxReconnectDelayMs: 100, logThrottleMs: 0};

        it("no conecta hasta la primera operación, salvo con connectOnBuild", async () => {
            await startServers();
            try {
                await withRedis([server], OPTIONS, async () => {
                    await sleep(100);
                    assert.equal(server.connections, 0);
                });
                await withRedis([server], {...OPTIONS, connectOnBuild: true}, async () => {
                    await waitUntil(() => server.connections > 0, "que conecte al crear");
                });
            } finally {
                await stopServers();
            }
        });

        it("un EXEC que no se contesta es `ambiguous`, y no tarda más que el timeout", async () => {
            await startServers();
            try {
                await withRedis([server], OPTIONS, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    server.mute = true;
                    const start = Date.now();
                    assert.equal(await redis.bulkHIncrBy(BATCH, {timeoutMs: 50}), "ambiguous");
                    assert.ok(Date.now() - start < 3_000);
                });
            } finally {
                await stopServers();
            }
        });

        it("timeoutMs manda sobre options.timeout: un EXEC sin contestar no espera al timeout largo", async () => {
            await startServers();
            try {
                await withRedis([server], {...OPTIONS, timeout: 2_500}, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    server.mute = true;
                    const start = Date.now();
                    assert.equal(await redis.bulkHIncrBy(BATCH, {timeoutMs: 50}), "ambiguous");
                    assert.ok(Date.now() - start < 2_000, "timeoutMs (50 ms) manda sobre options.timeout (2,5 s)");

                    // Sin timeoutMs se usa options.timeout.
                    const startDefault = Date.now();
                    assert.equal(await redis.bulkHIncrBy(BATCH, {timeoutMs: undefined}), "ambiguous");
                    assert.ok(Date.now() - startDefault >= 2_400);
                });
            } finally {
                await stopServers();
            }
        });

        it("si read es el mismo nodo que el nodo único, comparte el cliente: una sola conexión", async () => {
            await startServers();
            try {
                await withRedis([server], OPTIONS, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    await redis.bulkHGetAll(["h"], {node: "read"});
                    assert.equal(server.connections, 1);
                }, server);
            } finally {
                await stopServers();
            }
        });

        it("si read es otro nodo, tiene su propio cliente", async () => {
            await startServers();
            try {
                second.preloadHash(`${PREFIX}h`, {origin: "read"});
                await withRedis([server], OPTIONS, async redis => {
                    assert.deepEqual(await redis.bulkHGetAll(["h"], {node: "read"}), [{origin: "read"}]);
                    assert.equal(second.connections, 1);
                }, second);
            } finally {
                await stopServers();
            }
        });

        it("con un singleNode fuera de rango no crea ninguna conexión", async () => {
            await startServers();
            try {
                await withRedis([server], {...OPTIONS, singleNode: 3}, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "notSent");
                    await assert.rejects(redis.bulkHGetAll(["h"]), RangeError);
                });
                assert.equal(server.connections, 0);
            } finally {
                await stopServers();
            }
        });

        it("al liberarlo cierra las conexiones, aunque el servidor no conteste", async () => {
            await startServers();
            try {
                await withRedis([server], OPTIONS, async redis => {
                    assert.equal(await redis.bulkHIncrBy(BATCH), "ok");
                    assert.equal(server.open, 1);
                    server.mute = true; // el QUIT no se contesta: tiene que cerrar por su cuenta
                });
                await waitUntil(() => server.open === 0, "que se cierre la conexión");
            } finally {
                await stopServers();
            }
        });
    });

    interface IChildResult {
        code: number | null;
        killed: boolean;
        ms: number;
        output: string;
    }

    describe("procesos que terminan solos (jobs y cronjobs)", () => {
        /**
         * Lanza un proceso hijo que construye el cliente contra el servidor, hace una escritura con `await` y termina de la forma que se indique.
         * El hijo carga el código ya compilado de estas pruebas.
         *
         * @param port Puerto del servidor (o de uno que ya no escucha).
         * @param ending `"exit"`: `process.exit()` (como hace `Main` en los cronjobs); `"dispose"`: `await redis[Symbol.asyncDispose]()` y salir solo;
         *               `"nothing"`: ni lo uno ni lo otro.
         * @param killAfterMs Pasado este tiempo se mata al hijo (y se anota).
         */
        async function runChild(port: number, ending: "exit" | "dispose" | "nothing", killAfterMs: number, immediate = false): Promise<IChildResult> {
            return await runScript(port, killAfterMs, credentials => `
                const {Redis} = require(${JSON.stringify(path.join(__dirname, "../../../modules/database/redis/index.js"))});
                (async () => {
                    const redis = Redis.build({pod: {servicio: "hijo"}, credenciales: ${JSON.stringify(credentials)}, options: {clientTimeout: 500, maxReconnectDelayMs: 100, logThrottleMs: 0, connectOnBuild: ${JSON.stringify(immediate)}}});
                    if (${JSON.stringify(immediate)}) {
                        await redis[Symbol.asyncDispose]();
                        console.log("LIBERADO");
                        return;
                    }
                    const start = Date.now();
                    await redis.set("clave", Buffer.from("v"));
                    const result = await redis.bulkHIncrBy([{key: "c", field: "f", increment: 1, ttl: 60}], {timeoutMs: 3000});
                    console.log("ESCRITURA " + result + " " + (Date.now() - start));
                    if (${JSON.stringify(ending)} === "exit") { process.exit(); }
                    if (${JSON.stringify(ending)} === "dispose") { await redis[Symbol.asyncDispose](); }
                })();
            `);
        }

        /**
         * Lanza `node -e` con el script que devuelve `script` (recibe la ruta del fichero de credenciales) y espera a que termine, o lo mata pasado `killAfterMs`.
         */
        async function runScript(port: number, killAfterMs: number, script: (credentials: string) => string): Promise<IChildResult> {
            const directory = await fs.mkdtemp(path.join(os.tmpdir(), "redis-child-"));
            const credentials = path.join(directory, "redis.json");
            await fs.writeFile(credentials, JSON.stringify({host: "127.0.0.1", port: String(port)}));
            const code = script(credentials);
            const begin = Date.now();
            try {
                return await new Promise(resolve => {
                    let output = "";
                    let killed = false;
                    const child = spawn(process.execPath, ["-e", code], {env: process.env, stdio: ["ignore", "pipe", "ignore"]});
                    child.stdout.on("data", (data: Buffer) => {
                        output += data.toString();
                    });
                    const timer = setTimeout(() => {
                        killed = true;
                        child.kill("SIGKILL");
                    }, killAfterMs);
                    child.on("exit", exitCode => {
                        clearTimeout(timer);
                        resolve({code: exitCode, killed, ms: Date.now() - begin, output});
                    });
                });
            } finally {
                await fs.rm(directory, {recursive: true, force: true});
            }
        }

        it("con Redis caído, un job que escribe y termina (process.exit, como Main) sale enseguida y con código 0", async () => {
            await startServers();
            try {
                const port = server.port;
                await server.stop();
                const result = await runChild(port, "exit", 10_000);
                assert.equal(result.killed, false);
                assert.equal(result.code, 0);
                assert.match(result.output, /ESCRITURA notSent/);
            } finally {
                await stopServers();
            }
        });

        it("con Redis lento, el proceso no sale antes de la respuesta: la escritura con await se completa y luego termina", async () => {
            await startServers();
            try {
                server.delayMs = 300;
                const result = await runChild(server.port, "exit", 10_000);
                assert.equal(result.killed, false);
                assert.equal(result.code, 0);
                assert.match(result.output, /ESCRITURA ok/);
                const elapsed = Number(/ESCRITURA ok (\d+)/.exec(result.output)?.[1]);
                assert.ok(elapsed >= 600, `esperó las dos respuestas lentas (${elapsed} ms)`);
                assert.equal(server.seen("EXEC").length, 2, "el SET y el lote llegaron");
            } finally {
                await stopServers();
            }
        });

        it("sin process.exit, `await redis[Symbol.asyncDispose]()` deja salir al proceso aunque Redis esté caído", async () => {
            await startServers();
            try {
                const port = server.port;
                await server.stop();
                const result = await runChild(port, "dispose", 10_000);
                assert.equal(result.killed, false);
                assert.equal(result.code, 0);
            } finally {
                await stopServers();
            }
        });

        it("liberar el cliente justo al crearlo (a mitad de la conexión inicial) deja salir al proceso", async () => {
            await startServers();
            try {
                const result = await runChild(server.port, "dispose", 8_000, true);
                assert.equal(result.killed, false, "el PING de un cliente destruido a mitad del handshake mantenía vivo el proceso");
                assert.equal(result.code, 0);
                assert.match(result.output, /LIBERADO/);
            } finally {
                await stopServers();
            }
        });

        it("con los valores por defecto, tras liberar con Redis caído el proceso sale en menos de ~6,5 s (tope de reconexión de 5 s + azar)", async () => {
            await startServers();
            try {
                const port = server.port;
                await server.stop();
                const result = await runScript(port, 25_000, credentials => `
                    const {Redis} = require(${JSON.stringify(path.join(__dirname, "../../../modules/database/redis/index.js"))});
                    process.on("exit", () => { console.log("SALIDA " + Date.now()); });
                    (async () => {
                        const redis = Redis.build({pod: {servicio: "hijo"}, credenciales: ${JSON.stringify(credentials)}, options: {connectOnBuild: true}});
                        await new Promise(resolve => setTimeout(resolve, 1500)); // unos intentos de reconexión ya fallidos
                        await redis[Symbol.asyncDispose]();
                        console.log("LIBERADO " + Date.now());
                    })();
                `);
                assert.equal(result.killed, false);
                assert.equal(result.code, 0);
                const released = Number(/LIBERADO (\d+)/.exec(result.output)?.[1]);
                const exited = Number(/SALIDA (\d+)/.exec(result.output)?.[1]);
                assert.ok(exited - released < 6_500, `salió ${exited - released} ms después de liberar`);
            } finally {
                await stopServers();
            }
        });

        it("sin process.exit ni liberar el cliente, el proceso sigue vivo (el cliente no usa unref: sus temporizadores de PING y reconexión no se pueden soltar)", async () => {
            await startServers();
            try {
                const result = await runChild(server.port, "nothing", 2_500);
                assert.equal(result.killed, true);
                assert.match(result.output, /ESCRITURA ok/);
            } finally {
                await stopServers();
            }
        });
    });
});
