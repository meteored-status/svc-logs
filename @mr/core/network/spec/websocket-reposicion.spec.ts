/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: e88bae91694b310e53303216e9adf7d6
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {crearServidor, esperarHasta, type IServidorPrueba} from "./helpers";

import {afterEach, before, after, describe, it, type TestContext} from "node:test";
import assert from "node:assert/strict";
import type {WebSocket as WS} from "ws";

import {Deferred} from "services-comun/modules/utiles/promise";

import {WSPool, retardoReposicionMs} from "../client/websocket/index";
import type {IWSHandler} from "../server/websocket/handler";

/**
 * Reposición de conexiones del `WSPool` tras perder una (con jitter, sin duplicar lo que está en vuelo) y limpieza
 * de `destroy()`.
 *
 * El fallo que cubre no rompe nada a la vista: un pool que repone de más o que abre sockets tras `destroy()` sigue
 * sirviendo peticiones, y solo se nota en las reconexiones masivas de producción o en un proceso que no termina.
 */

const pausa = async (ms: number): Promise<void> => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Handshake que tarda `RETRASO_MS` en autorizarse: da una ventana con el socket en vuelo. */
const RETRASO_MS = 300;
const lento: IWSHandler = {
    method: ["lento"],
    ruta: "/lento/",
    autorizar: async () => {
        await pausa(RETRASO_MS);
        return true;
    },
    handler: async (ws) => {
        ws.sendRespuesta({data: "ok"});
    },
};

/** Nunca responde mientras dura el test: deja la petición colgada en el cliente. */
let liberarColgado = new Deferred<void>();
const colgado: IWSHandler = {
    method: ["colgado"],
    handler: async () => {
        // Se libera al terminar el test: el timeout de 30 s del servidor para el handler, si no, retendría el proceso
        await liberarColgado.promise;
    },
};

const normal: IWSHandler = {
    method: ["ping"],
    handler: async (ws) => {
        ws.sendRespuesta({data: "pong"});
    },
};

let servidor: IServidorPrueba;
const pools: WSPool[] = [];
/** Conexiones que ha aceptado el servidor desde el principio, aunque ya se hayan cerrado: una abierta y cerrada enseguida también cuenta. */
let aceptadas = 0;

const clientes = (): Map<WS, unknown> => (servidor.ws as unknown as {clientes: Map<WS, unknown>}).clientes;
const privado = (pool: WSPool): {refillConnections(): void; connections: unknown[]} => pool as unknown as {refillConnections(): void; connections: unknown[]};

const crearPool = (ruta: string, {refillJitterMs, reconnect = false}: {refillJitterMs: number; reconnect?: boolean}): WSPool => {
    const pool = WSPool.get({socket: `ws://127.0.0.1:${servidor.puerto}${ruta}`, minConnections: 1, reconnect, refillJitterMs});
    pools.push(pool);

    return pool;
};

/** El servidor manda `Shutdown` a ese cliente, como el reciclado por edad o el apagado. */
const mandarShutdown = (ws: WS): void => {
    ws.send(JSON.stringify({ok: false, info: {message: "Shutdown"}}));
};

const fijarAzar = (t: TestContext, valor: number): void => {
    t.mock.method(Math, "random", () => valor);
};

describe("retardoReposicionMs", () => {
    it("va de 0 a jitterMs sin llegar a él, y con jitter 0 (o negativo) es 0", () => {
        assert.equal(retardoReposicionMs(3000, () => 0), 0);
        assert.equal(retardoReposicionMs(3000, () => 0.5), 1500);
        assert.ok(retardoReposicionMs(3000, () => 0.999999) < 3000);
        assert.equal(retardoReposicionMs(0, () => 0.9), 0);
        assert.equal(retardoReposicionMs(-5, () => 0.9), 0);
    });
});

describe("reposición del WSPool", () => {
    before(async () => {
        servidor = await crearServidor([lento, colgado, normal]);
        (servidor.ws as unknown as {server: {on(evento: string, cb: () => void): void}}).server.on("connection", () => {
            aceptadas++;
        });
    });

    afterEach(async () => {
        liberarColgado.resolve();
        liberarColgado = new Deferred<void>();
        for (const pool of pools.splice(0)) {
            pool.destroy();
        }
        await esperarHasta(() => clientes().size === 0);
    });

    after(async () => {
        await servidor.cerrar();
    });

    it("con refillJitterMs 0 repone enseguida tras el Shutdown (como antes)", async () => {
        crearPool("/jitter0/", {refillJitterMs: 0});
        await esperarHasta(() => clientes().size === 1);
        const [viejo] = [...clientes().keys()];
        mandarShutdown(viejo!);

        await esperarHasta(() => [...clientes().keys()].some(ws => ws !== viejo), 300);
        assert.ok([...clientes().keys()].some(ws => ws !== viejo), "no se repuso la conexión");
    });

    it("con jitter largo no repone en segundo plano, pero la apertura bajo demanda es inmediata y no se duplica", async (t) => {
        fijarAzar(t, 0.5);
        const pool = crearPool("/jitter-largo/", {refillJitterMs: 3_600_000});
        await esperarHasta(() => clientes().size === 1);
        const [viejo] = [...clientes().keys()];
        mandarShutdown(viejo!);
        await esperarHasta(() => clientes().size === 0);

        await pausa(300);
        assert.equal(clientes().size, 0, "repuso en segundo plano pese al jitter");

        const t0 = Date.now();
        await pool.head("ping", {});
        assert.ok(Date.now() - t0 < 200, "la petición esperó al jitter");
        await esperarHasta(() => clientes().size === 1);

        // La reposición, cuando venza, ve el déficit cubierto y no abre otra
        privado(pool).refillConnections();
        await pausa(200);
        assert.equal(clientes().size, 1, "hay más de una conexión nueva");
    });

    it("destroy() con una reposición programada no deja ninguna conexión nueva", async (t) => {
        fijarAzar(t, 0.99);
        const pool = crearPool("/destroy-programada/", {refillJitterMs: 100});
        await esperarHasta(() => clientes().size === 1);
        const [viejo] = [...clientes().keys()];
        mandarShutdown(viejo!);
        await esperarHasta(() => clientes().size === 0);
        const antes = aceptadas;
        pool.destroy();

        await pausa(300);
        assert.equal(aceptadas, antes, "se abrió un socket tras destroy()");
        assert.equal(clientes().size, 0);
    });

    it("destroy() con un handshake en vuelo cierra el socket al abrirse y no lo guarda", async () => {
        const pool = crearPool("/lento/", {refillJitterMs: 0});
        // el constructor ya lanzó el handshake, que tarda RETRASO_MS en autorizarse
        pool.destroy();
        const antes = aceptadas;

        await pausa(RETRASO_MS + 400);
        assert.equal(privado(pool).connections.length, 0);
        assert.equal(aceptadas, antes + 1, "el handshake en vuelo debía llegar a abrirse en el servidor");
        assert.equal(clientes().size, 0, "el socket que abrió tras destroy() sigue abierto");
    });

    it("cuenta los handshakes en vuelo al calcular lo que falta: no abre otro", async () => {
        const pool = crearPool("/lento/", {refillJitterMs: 0});
        // handshake del constructor en vuelo: refillConnections no debe abrir un segundo socket
        privado(pool).refillConnections();
        privado(pool).refillConnections();

        await pausa(RETRASO_MS + 300);
        assert.equal(clientes().size, 1);
    });

    it("si el constructor del WebSocket lanza (cabecera ilegal) no queda nada en vuelo contado", async () => {
        const pool = WSPool.get({socket: `ws://127.0.0.1:${servidor.puerto}/cabecera-ilegal/`, minConnections: 1, reconnect: false, refillJitterMs: 0, headers: {"x-malo\n": "a"}});
        pools.push(pool);
        await pausa(100);

        assert.equal((pool as unknown as {pendingConnections: number}).pendingConnections, 0);
        assert.equal(clientes().size, 0);
    });

    it("tras destroy() un get() cuya conexión cae rechaza enseguida y no abre ningún socket", async () => {
        const pool = crearPool("/", {refillJitterMs: 0, reconnect: true});
        await esperarHasta(() => clientes().size === 1);
        const resultado = await pool.get("colgado", {});
        const siguiente = resultado.generator.next();
        siguiente.catch(() => undefined);
        await pausa(50);

        const antes = aceptadas;
        const t0 = Date.now();
        pool.destroy();
        await assert.rejects(siguiente, /pool destruido/);
        assert.ok(Date.now() - t0 < 1000, "tardó en rechazar");

        await pausa(300);
        assert.equal(aceptadas, antes, "el bucle de reconexión abrió un socket");
        assert.equal(clientes().size, 0);
    });
});
