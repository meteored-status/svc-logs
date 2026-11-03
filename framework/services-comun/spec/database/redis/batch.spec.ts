/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: fc58e1c631ef7fdd820a9c3789cd4c9a
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

import {describe, it} from "node:test";
import {setTimeout as sleep} from "node:timers/promises";
import assert from "node:assert/strict";

import {AbortError, ClientClosedError, ClientOfflineError, createClient, ErrorReply, MultiErrorReply, SocketClosedUnexpectedlyError, SocketTimeoutError, TimeoutError} from "redis";

import {RedisBatch, type IBatchClient, type IBatchMulti, type IHIncrBy} from "../../../modules/database/redis/batch";
import {PromiseTimeoutError} from "../../../modules/utiles/promise";
import {FakeResp} from "./fake-resp";

/**
 * Cliente falso: anota lo que se le pide y deja que cada prueba decida cómo termina el `EXEC`.
 */
class FakeClient implements IBatchClient {
    public readonly commands: string[][];
    public multis: number;

    public constructor(public isReady: boolean, private readonly exec: () => Promise<unknown[]>) {
        this.commands = [];
        this.multis = 0;
    }

    public multi(): IBatchMulti {
        this.multis++;
        const commands = this.commands;
        const exec = this.exec;
        const multi: IBatchMulti = {
            hIncrBy(key: string, field: string, increment: number) {
                commands.push(["HINCRBY", key, field, String(increment)]);
                return multi;
            },
            expire(key: string, seconds: number) {
                commands.push(["EXPIRE", key, String(seconds)]);
                return multi;
            },
            exec,
        };
        return multi;
    }
}

function item(key: string, field: string, increment: number, ttl: number): IHIncrBy {
    return {key, field, increment, ttl};
}

describe("RedisBatch.classifyError", () => {
    it("los errores reales de node-redis que garantizan que no salió nada son `notSent`", () => {
        assert.equal(RedisBatch.classifyError(new ClientOfflineError()), "notSent");
        assert.equal(RedisBatch.classifyError(new ClientClosedError()), "notSent");
        assert.equal(RedisBatch.classifyError(new AbortError()), "notSent");
        assert.equal(RedisBatch.classifyError(new Error("The queue is full")), "notSent");
    });

    it("tras enviar (o sin saber si se envió) es `ambiguous`", () => {
        assert.equal(RedisBatch.classifyError(new TimeoutError()), "ambiguous");
        assert.equal(RedisBatch.classifyError(new SocketClosedUnexpectedlyError()), "ambiguous");
        assert.equal(RedisBatch.classifyError(new SocketTimeoutError(2000)), "ambiguous");
        assert.equal(RedisBatch.classifyError(new ErrorReply("ERR algo")), "ambiguous");
        assert.equal(RedisBatch.classifyError(new MultiErrorReply([new ErrorReply("x")], [0])), "ambiguous");
    });

    it("«The queue is full» es notSent solo si el mensaje es exactamente ese", () => {
        assert.equal(RedisBatch.classifyError(new Error("The queue is full")), "notSent");
        assert.equal(RedisBatch.classifyError(new Error("The queue is full, retry")), "ambiguous");
        assert.equal(RedisBatch.classifyError(new Error("the queue is full")), "ambiguous");
    });

    it("node-redis 6.3.0 rechaza con «The queue is full» antes de enviar nada: el servidor nunca ve el comando rechazado", async () => {
        const server = await FakeResp.start();
        // Cabe el handshake (que ocupa la cola un instante) y poco más.
        const client = createClient({url: `redis://127.0.0.1:${server.port}`, commandsQueueMaxLength: 6, disableOfflineQueue: true, pingInterval: 0});
        client.on("error", () => undefined);
        try {
            await client.connect();
            server.mute = true; // los comandos se envían y se quedan esperando respuesta, ocupando la cola
            const pending = Array.from({length: 6}, (_, i) => client.get(`pendiente${i}`).catch(() => undefined));
            const rejected = await client.get("desbordado").then(() => null, (err: unknown) => err);
            assert.ok(rejected instanceof Error);
            assert.equal(rejected.message, "The queue is full");
            assert.equal(RedisBatch.classifyError(rejected), "notSent");
            await sleep(100);
            assert.equal(server.seen("GET").length, 6, "los seis primeros llegaron");
            assert.ok(!server.seen("GET").some(args => args[1] === "desbordado"), "el rechazado no llegó al servidor");
            void pending;
        } finally {
            client.destroy();
            await server.stop();
        }
    });

    it("el timeout propio del lote (PromiseTimeoutError) es `ambiguous`", () => {
        assert.equal(RedisBatch.classifyError(new PromiseTimeoutError(2000)), "ambiguous");
    });

    it("ante cualquier otra cosa, `ambiguous`", () => {
        for (const err of [new Error("boom"), new TypeError("x"), "texto", undefined, null, 42, {name: "ClientOfflineError"}]) {
            assert.equal(RedisBatch.classifyError(err), "ambiguous", String(err));
        }
    });
});

describe("new RedisBatch (validación)", () => {
    it("acepta incrementos enteros distintos de 0 (también negativos) y TTL enteros positivos", () => {
        assert.doesNotThrow(() => new RedisBatch([item("k", "f", 1, 1), item("k", "g", -5, 60), item("k", "h", Number.MAX_SAFE_INTEGER, 3600)]));
    });

    it("un lote vacío es válido", () => {
        assert.doesNotThrow(() => new RedisBatch([]));
    });

    it("rechaza con RangeError un increment que no sea entero seguro distinto de 0", () => {
        for (const increment of [0, 0.5, -0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            assert.throws(() => new RedisBatch([item("k", "f", increment, 10)]), RangeError, `increment ${increment}`);
        }
    });

    it("rechaza con RangeError un ttl que no sea entero mayor que 0", () => {
        for (const ttl of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            assert.throws(() => new RedisBatch([item("k", "f", 1, ttl)]), RangeError, `ttl ${ttl}`);
        }
    });

    it("basta con que un elemento del lote sea inválido", () => {
        assert.throws(() => new RedisBatch([item("k", "f", 1, 10), item("k", "g", 1, 10), item("k", "h", 0, 10)]), RangeError);
    });
});

describe("RedisBatch.ttls (agrupación de TTL)", () => {
    it("un solo EXPIRE por clave, con el mayor TTL del lote", () => {
        const batch = new RedisBatch([item("a", "x", 1, 60), item("b", "x", 1, 30), item("a", "y", 1, 300), item("a", "z", 1, 120), item("b", "y", 1, 10)]);
        assert.deepEqual([...batch.ttls], [["a", 300], ["b", 30]]);
    });

    it("un lote vacío no genera ningún EXPIRE", () => {
        assert.equal(new RedisBatch([]).ttls.size, 0);
    });
});

describe("RedisBatch.execute", () => {
    const batch = (): RedisBatch => new RedisBatch([item("key", "field", 3, 60)]);

    it("sin conexión lista es `notSent` y ni siquiera abre la transacción", async () => {
        const client = new FakeClient(false, async () => [1, 1]);
        assert.equal(await batch().execute(client, 100), "notSent");
        assert.equal(client.multis, 0);
        assert.deepEqual(client.commands, []);
    });

    it("con el EXEC confirmado es ok, y los comandos llegan a la transacción: un HINCRBY por incremento y un EXPIRE por clave", async () => {
        const client = new FakeClient(true, async () => [3, 1]);
        assert.equal(await batch().execute(client, 100), "ok");
        assert.deepEqual(client.commands, [["HINCRBY", "key", "field", "3"], ["EXPIRE", "key", "60"]]);
    });

    it("varios incrementos de la misma clave llevan un solo EXPIRE, con el mayor TTL, tras todos los HINCRBY", async () => {
        const client = new FakeClient(true, async () => [1, 1, 1, 1, 1]);
        const lote = new RedisBatch([item("a", "x", 1, 60), item("b", "x", -2, 30), item("a", "y", 5, 300)]);
        assert.equal(await lote.execute(client, 100), "ok");
        assert.deepEqual(client.commands, [
            ["HINCRBY", "a", "x", "1"], ["HINCRBY", "b", "x", "-2"], ["HINCRBY", "a", "y", "5"],
            ["EXPIRE", "a", "300"], ["EXPIRE", "b", "30"],
        ]);
    });

    it("un EXEC que no termina es `ambiguous` (el lote pudo llegar), sin esperar más que el timeout", async () => {
        const client = new FakeClient(true, () => new Promise<unknown[]>(() => {}));
        const start = Date.now();
        assert.equal(await batch().execute(client, 20), "ambiguous");
        assert.ok(Date.now() - start < 3_000);
    });

    it("los errores que garantizan que no salió nada son `notSent`", async () => {
        for (const err of [new ClientOfflineError(), new ClientClosedError(), new AbortError(), new Error("The queue is full")]) {
            const client = new FakeClient(true, async () => { throw err; });
            assert.equal(await batch().execute(client, 100), "notSent", err.constructor.name);
        }
    });

    it("el resto de errores son ambiguos", async () => {
        for (const err of [new SocketClosedUnexpectedlyError(), new TimeoutError(), new ErrorReply("ERR x"), new MultiErrorReply([new ErrorReply("x")], [0]), new Error("boom")]) {
            const client = new FakeClient(true, async () => { throw err; });
            assert.equal(await batch().execute(client, 100), "ambiguous", err.constructor.name);
        }
    });

    it("un EXEC con un error parcial dentro del resultado es `ambiguous`", async () => {
        const client = new FakeClient(true, async () => [3, new ErrorReply("ERR value is not an integer")]);
        assert.equal(await batch().execute(client, 100), "ambiguous");
    });

    it("nunca rechaza, ni siquiera si el cliente lanza al abrir la transacción", async () => {
        const client: IBatchClient = {isReady: true, multi: () => { throw new Error("al abrir"); }};
        assert.equal(await batch().execute(client, 100), "ambiguous");
    });
});
