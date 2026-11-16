/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: fb393508f0ba8510fcdfcdf98ccd7d1b
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {esperarHasta} from "./helpers";

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type {AddressInfo} from "node:net";
import {WebSocket as WS} from "ws";

import wsServer from "../server/websocket/index";
import type {IWSHandler} from "../server/websocket/handler";
import type {Net} from "../server/http/config/net";
import type {Routes} from "../server/http/routes";
import {Respuesta} from "../server/http/respuesta";
import {Server} from "../server/http/server";

/**
 * `Server.close()` con conexiones que `http.Server.close()` no cierra solo: un WebSocket entrante abierto y
 * una keep-alive ociosa. Antes de cerrar el servidor WebSocket y las ociosas, `close()` solo salía por su
 * timeout (en producción, 20 s entonces) y el SIGKILL llegaba antes de `antesDeSalir`.
 */

const TIMEOUT_MS = 10_000;
const config = {shutdownTimeout: TIMEOUT_MS} as Net;
Respuesta.setContextoDefecto({service: "prueba", pod: "prueba", zona: "local", version: "0"});
const configHTTP = {shutdownTimeout: 2000, cacheTags: [], compress: false, keepAliveTimeout: 5000, headersTimeout: 6000, slow: 0, trustProxy: false, maxRequestBodySize: 1024, uploadDir: "/tmp", maxFileSize: 1024} as unknown as Net;

const handler: IWSHandler = {
    method: ["ping"],
    handler: async (ws) => {
        ws.sendRespuesta({data: "pong"});
    },
};

describe("Server.close() con conexiones abiertas", () => {
    it("con un WebSocket, una keep-alive ociosa y otra con petición en vuelo resuelve mucho antes del timeout y ejecuta antesDeSalir", async () => {
        let lentaRecibida = false;
        const nativo = http.createServer((req, res) => {
            lentaRecibida ||= req.url === "/lenta";
            // `/lenta`: la respuesta llega cuando `close()` ya ha empezado, así que la conexión se queda ociosa después.
            setTimeout(() => res.end("ok"), req.url === "/lenta" ? 300 : 0);
        });
        await new Promise<void>(resolve => nativo.listen(0, "127.0.0.1", resolve));
        const puerto = (nativo.address() as AddressInfo).port;
        wsServer(nativo, [handler]);

        const servidor = new Server();
        (servidor as unknown as {serverHTTP: http.Server}).serverHTTP = nativo;
        const eventos: string[] = [];
        servidor.antesDeSalir(async () => {
            eventos.push("antes");
        });

        // WebSocket de un cliente que obedece al `Shutdown` del servidor.
        const cliente = new WS(`ws://127.0.0.1:${puerto}/`);
        cliente.on("message", (datos) => {
            if ((JSON.parse(datos.toString()) as {info?: {message?: string}}).info?.message === "Shutdown") {
                cliente.close();
            }
        });
        await new Promise<void>((resolve, reject) => {
            cliente.once("open", () => resolve());
            cliente.once("error", reject);
        });

        // Keep-alive ociosa: una petición completa por una conexión que se queda abierta.
        const agente = new http.Agent({keepAlive: true, maxSockets: 1});
        const agenteLento = new http.Agent({keepAlive: true, maxSockets: 1});
        await new Promise<void>((resolve, reject) => {
            http.get({host: "127.0.0.1", port: puerto, agent: agente}, (res) => {
                res.resume();
                res.on("end", () => resolve());
            }).on("error", reject);
        });

        // Keep-alive con una petición en vuelo cuando empieza el cierre.
        const lenta = new Promise<void>((resolve, reject) => {
            http.get({host: "127.0.0.1", port: puerto, path: "/lenta", agent: agenteLento}, (res) => {
                res.resume();
                res.on("end", () => resolve());
            }).on("error", reject);
        });

        await esperarHasta(() => lentaRecibida);
        assert.ok(lentaRecibida, "la petición lenta no llegó al servidor");

        const t0 = Date.now();
        await servidor.cerrarYSalir(config, {salir: (codigo) => eventos.push(`salir:${codigo}`)});
        const espera = Date.now() - t0;
        await lenta;
        agente.destroy();
        agenteLento.destroy();

        assert.deepEqual(eventos, ["antes", "salir:0"]);
        assert.ok(espera < 2000, `cerrar tardó ${espera} ms (timeout ${TIMEOUT_MS} ms)`);
        assert.equal(nativo.listening, false);
    });

    it("durante el margen de antesDeCerrar el servidor sigue atendiendo peticiones y tras close() responde con Connection: close", async () => {
        const rutas = {
            error: {check: async (): Promise<boolean> => true},
            check: async (conexion: {sendRespuesta(data: unknown): Promise<number>}): Promise<boolean> => {
                await conexion.sendRespuesta({ok: true});
                return true;
            },
        } as unknown as Routes;
        const nativo = http.createServer((req, res) => {
            (servidor as unknown as {onRequest(...args: unknown[]): void}).onRequest(req, res, rutas, configHTTP, false);
        });
        await new Promise<void>(resolve => nativo.listen(0, "127.0.0.1", resolve));
        const puerto = (nativo.address() as AddressInfo).port;
        const servidor = new Server();
        (servidor as unknown as {serverHTTP: http.Server}).serverHTTP = nativo;

        const agente = new http.Agent({keepAlive: true, maxSockets: 1});
        const pedir = (): Promise<{status: number|undefined; connection: string|undefined}> => new Promise((resolve, reject) => {
            http.get({host: "127.0.0.1", port: puerto, agent: agente}, (res) => {
                res.resume();
                res.on("end", () => resolve({status: res.statusCode, connection: res.headers["connection"]}));
            }).on("error", reject);
        });

        // Antes de cerrar: keep-alive normal.
        const previa = await pedir();
        assert.equal(previa.status, 200);
        assert.notEqual(previa.connection, "close");

        let duranteMargen: {status: number|undefined; connection: string|undefined}|undefined;
        servidor.antesDeCerrar(async () => {
            assert.equal(servidor.isShuttingDown(), true);
            duranteMargen = await pedir();
        });
        const eventos: string[] = [];
        await servidor.cerrarYSalir(configHTTP, {salir: (codigo) => eventos.push(`salir:${codigo}`)});
        agente.destroy();

        assert.equal(duranteMargen?.status, 200, "la petición durante el margen debe atenderse");
        assert.notEqual(duranteMargen?.connection, "close", "durante el margen aún no se cierra la conexión");
        assert.deepEqual(eventos, ["salir:0"]);
        assert.equal(nativo.listening, false);
    });

    it("una respuesta que sale por una keep-alive cuando close() ya ha empezado lleva con Connection: close", async () => {
        let soltar: () => void = () => undefined;
        const puerta = new Promise<void>(resolve => { soltar = resolve; });
        let lentaRecibida = false;
        const rutas = {
            error: {check: async (): Promise<boolean> => true},
            check: async (conexion: {getPeticion(): http.IncomingMessage; sendRespuesta(data: unknown): Promise<number>}): Promise<boolean> => {
                if (conexion.getPeticion().url === "/lenta") {
                    lentaRecibida = true;
                    await puerta;
                }
                await conexion.sendRespuesta({ok: true});
                return true;
            },
        } as unknown as Routes;
        const nativo = http.createServer((req, res) => {
            (servidor as unknown as {onRequest(...args: unknown[]): void}).onRequest(req, res, rutas, configHTTP, false);
        });
        await new Promise<void>(resolve => nativo.listen(0, "127.0.0.1", resolve));
        const puerto = (nativo.address() as AddressInfo).port;
        const servidor = new Server();
        (servidor as unknown as {serverHTTP: http.Server}).serverHTTP = nativo;

        // Una keep-alive con una petición en vuelo cuando empieza el cierre: su respuesta sale ya con `close()` en
        // marcha, así que el servidor la marca `Connection: close` y el proxy no reutiliza el socket.
        const agente = new http.Agent({keepAlive: true, maxSockets: 1});
        const conexion = new Promise<string|undefined>((resolve, reject) => {
            http.get({host: "127.0.0.1", port: puerto, path: "/lenta", agent: agente}, (res) => {
                res.resume();
                res.on("end", () => resolve(res.headers["connection"]));
            }).on("error", reject);
        });
        await esperarHasta(() => lentaRecibida);
        const cierre = servidor.close(5000);
        soltar();
        const valor = await conexion;
        await cierre;
        agente.destroy();
        assert.equal(valor, "close");
    });
});
