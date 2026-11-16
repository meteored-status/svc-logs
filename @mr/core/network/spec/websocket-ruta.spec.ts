/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 20b1447041c7d87107d94e8042adb599
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {crearServidor, esperarHasta, type IServidorPrueba} from "./helpers";

import {after, afterEach, before, describe, it} from "node:test";
import assert from "node:assert/strict";
import type {IncomingMessage} from "node:http";
import {WebSocket as WS} from "ws";

import {WSPool} from "../client/websocket/index";
import type {IWSHandler} from "../server/websocket/handler";

/**
 * Ruta y autorización por handler en el handshake WebSocket (`IWSHandler.ruta` / `IWSHandler.autorizar`).
 *
 * Es el sitio donde un error no rompe la compilación: si el 401 o el aislamiento entre rutas fallan, el
 * servidor sigue funcionando y lo único que se nota es que cualquiera puede mandar heartbeats, o que una
 * conexión de logs puede ejecutar el método del heartbeat.
 */

const RUTA = "/status/external/heartbeat/";
const TOKEN = "secreto";

interface IRecibido {
    params: unknown;
    ruta: string|undefined;
    token: string|string[]|undefined;
}

let recibidos: IRecibido[];
let servidor: IServidorPrueba;
const pools: WSPool[] = [];
const sockets: WS[] = [];

const heartbeat: IWSHandler = {
    method: ["heartbeat"],
    ruta: RUTA,
    autorizar: (req: IncomingMessage) => req.headers["x-mr-heartbeat"] === TOKEN,
    handler: async (ws, params) => {
        recibidos.push({params, ruta: ws.ruta, token: ws.request?.headers["x-mr-heartbeat"]});
        ws.sendRespuesta({data: "ok"});
    },
};

const global: IWSHandler = {
    method: ["ping"],
    handler: async (ws) => {
        ws.sendRespuesta({data: "pong"});
    },
};

const abrir = async (ruta: string, headers: Record<string, string> = {}): Promise<WS> => {
    const ws = new WS(`ws://127.0.0.1:${servidor.puerto}${ruta}`, {headers});
    sockets.push(ws);
    await new Promise<void>((resolve, reject) => {
        ws.once("open", () => resolve());
        ws.once("error", reject);
        ws.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    });

    return ws;
};

/** Llama a un método por un socket crudo y devuelve la primera respuesta con ese id. */
const llamar = async (ws: WS, method: string): Promise<{ok: boolean; data?: unknown; info?: {message: string}}> => {
    const id = `${method}-${Math.random()}`;
    const respuesta = new Promise<{ok: boolean; data?: unknown; info?: {message: string}}>((resolve) => {
        ws.on("message", (raw) => {
            const msg = JSON.parse(raw.toString()) as {id?: string};
            if (msg.id === id) {
                resolve(msg as never);
            }
        });
    });
    ws.send(JSON.stringify({id, method, buffer: false, params: {}}));

    return respuesta;
};

const poolHeartbeat = (headers?: Record<string, string>, ruta = RUTA): WSPool => {
    const pool = WSPool.get({socket: `ws://127.0.0.1:${servidor.puerto}${ruta}`, headers, minConnections: 1, reconnect: false});
    pools.push(pool);

    return pool;
};

describe("ruta y autorización en el handshake", () => {
    before(async () => {
        servidor = await crearServidor([heartbeat, global]);
    });

    afterEach(() => {
        recibidos = [];
        for (const pool of pools.splice(0)) {
            pool.destroy();
        }
        for (const ws of sockets.splice(0)) {
            ws.terminate();
        }
    });

    after(async () => {
        await servidor.cerrar();
    });

    it("con el token bueno conecta, y el cliente envía de verdad la cabecera", async () => {
        recibidos = [];
        const pool = poolHeartbeat({"x-mr-heartbeat": TOKEN});
        await pool.head("heartbeat", {pod: "a"});
        await esperarHasta(() => recibidos.length > 0);

        assert.equal(recibidos.length, 1);
        assert.deepEqual(recibidos[0]!.params, {pod: "a"});
        assert.equal(recibidos[0]!.ruta, RUTA);
        assert.equal(recibidos[0]!.token, TOKEN);
    });

    it("destroy() cierra todas las conexiones y el pool no repone otras", async () => {
        const clientes = (servidor.ws as unknown as {clientes: Map<unknown, unknown>}).clientes;
        await esperarHasta(() => clientes.size === 0);
        const pool = poolHeartbeat({"x-mr-heartbeat": TOKEN});
        await pool.head("heartbeat", {});
        await esperarHasta(() => clientes.size === 2);
        pool.destroy();
        await esperarHasta(() => clientes.size === 0);
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        assert.equal(clientes.size, 0);
    });

    it("con el token malo o sin él, el handshake termina en 401 y no hay socket", async () => {
        const clientes = (servidor.ws as unknown as {clientes: Map<unknown, unknown>}).clientes;
        // Las conexiones del test anterior se cierran de forma asíncrona.
        await esperarHasta(() => clientes.size === 0);
        for (const headers of [{"x-mr-heartbeat": "otro"}, {}]) {
            const estado = await new Promise<number|string>((resolve) => {
                const ws = new WS(`ws://127.0.0.1:${servidor.puerto}${RUTA}`, {headers});
                sockets.push(ws);
                ws.once("open", () => resolve("open"));
                ws.once("error", () => resolve("error"));
                ws.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
            });
            assert.equal(estado, 401);
        }
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        assert.equal(clientes.size, 0);
    });

    it("un handshake rechazado cuenta como fallo de conexión del circuit breaker", async () => {
        const pool = poolHeartbeat({"x-mr-heartbeat": "malo"}, `${RUTA}?circuito`);
        for (let i = 0; i < 5; i++) {
            await assert.rejects(pool.head("heartbeat", {}));
        }
        assert.equal(pool.getCircuitState(), "open");
        await assert.rejects(pool.head("heartbeat", {}), /Circuit breaker open/);
        assert.equal(recibidos.length, 0);
    });

    it("la ruta se normaliza: sin barra final y con query también ligan", async () => {
        const a = await abrir("/status/external/heartbeat", {"x-mr-heartbeat": TOKEN});
        const b = await abrir(`${RUTA}?x=1`, {"x-mr-heartbeat": TOKEN});
        assert.equal((await llamar(a, "heartbeat")).ok, true);
        assert.equal((await llamar(b, "heartbeat")).ok, true);
        assert.equal(recibidos.length, 2);
    });

    it("una conexión a la ruta del heartbeat no puede llamar a un método sin ruta", async () => {
        const ws = await abrir(RUTA, {"x-mr-heartbeat": TOKEN});
        const respuesta = await llamar(ws, "ping");
        assert.equal(respuesta.ok, false);
        assert.match(respuesta.info!.message, /No handler for method ping/);
    });

    it("una conexión a otra ruta no puede llamar al método del heartbeat, y un handler sin ruta sigue funcionando", async () => {
        for (const ruta of ["/logs/service/", "/", "/status/external/"]) {
            const ws = await abrir(ruta);
            const respuesta = await llamar(ws, "heartbeat");
            assert.equal(respuesta.ok, false, ruta);
            assert.match(respuesta.info!.message, /No handler for method heartbeat/);
            const pong = await llamar(ws, "ping");
            assert.equal(pong.ok, true, ruta);
            assert.equal(pong.data, "pong");
        }
        assert.equal(recibidos.length, 0);
    });

    it("una ruta sin autorizar es de acceso libre pero sigue aislada", async () => {
        const abierto: IWSHandler = {method: ["abierto"], ruta: "/libre", handler: async (ws) => {
            ws.sendRespuesta({data: "libre"});
        }};
        servidor.ws.addHandlers([abierto]);

        const ws = await abrir("/libre/");
        assert.equal((await llamar(ws, "abierto")).data, "libre");
        assert.equal((await llamar(ws, "ping")).ok, false);
    });

    it("si autorizar rechaza o lanza, también es 401", async () => {
        const lanza: IWSHandler = {method: ["x"], ruta: "/lanza/", autorizar: async () => {
            throw new Error("boom");
        }, handler: async () => undefined};
        servidor.ws.addHandlers([lanza]);

        await assert.rejects(abrir("/lanza/"), /HTTP 401/);
    });
});
