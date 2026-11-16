/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 51fdd22393c41bb5f22d6de529c914a6
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./helpers";

import {after, describe, it} from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type {AddressInfo} from "node:net";
import {type WebSocket as WS, WebSocketServer} from "ws";

import {avisos, limpiarAvisos} from "./stubs/log";
import {WSPool} from "../client/websocket/index";

/**
 * Cliente `WSPool`: `vaciar()` (la despedida de «parado» depende de que no vuelva antes de tiempo ni
 * se quede colgado) y el aviso por cabeceras distintas sobre un singleton existente.
 */

const pools: WSPool[] = [];
const nuevo = (socket: string, headers?: Record<string, string>): WSPool => {
    const pool = WSPool.get({socket, headers, minConnections: 1, reconnect: false});
    pools.push(pool);

    return pool;
};

describe("WSPool.vaciar()", () => {
    const servidor = http.createServer();
    const wss = new WebSocketServer({server: servidor});
    let lado: WS|undefined;
    wss.on("connection", (ws) => {
        lado = ws;
    });

    after(async () => {
        for (const pool of pools.splice(0)) {
            pool.destroy();
        }
        lado?.terminate();
        wss.close();
        servidor.closeAllConnections();
        await new Promise<void>(resolve => servidor.close(() => resolve()));
    });

    it("sin nada pendiente resuelve enseguida", async () => {
        await new Promise<void>(resolve => servidor.listen(0, "127.0.0.1", resolve));
        const pool = nuevo(`ws://127.0.0.1:${(servidor.address() as AddressInfo).port}/vaciar/`);
        await pool.head("x", {});

        const t0 = Date.now();
        await pool.vaciar({timeoutMs: 5000});
        assert.ok(Date.now() - t0 < 1000);
    });

    it("con el receptor parado vence el timeout sin rechazar, y cuando drena resuelve antes del timeout", async () => {
        const pool = nuevo(`ws://127.0.0.1:${(servidor.address() as AddressInfo).port}/vaciar/`);
        await pool.head("x", {});
        // El receptor deja de leer: lo que se envíe se queda en el buffer de salida del cliente.
        (lado as unknown as {_socket: {pause(): void; resume(): void}})._socket.pause();
        await pool.head("x", {relleno: "a".repeat(64 * 1024 * 1024)});

        const t0 = Date.now();
        await pool.vaciar({timeoutMs: 300});
        const espera = Date.now() - t0;
        assert.ok(espera >= 250, `volvió antes del timeout (${espera} ms) con datos aún en el buffer`);

        const t1 = Date.now();
        const vaciado = pool.vaciar({timeoutMs: 10_000});
        (lado as unknown as {_socket: {resume(): void}})._socket.resume();
        await vaciado;
        assert.ok(Date.now() - t1 < 9000, "no resolvió al drenarse el buffer");
    });
});

describe("WSPool.get() con cabeceras", () => {
    after(() => {
        for (const pool of pools.splice(0)) {
            pool.destroy();
        }
    });

    it("avisa una sola vez si se pide un pool existente con otras cabeceras, y no lo sobrescribe", () => {
        limpiarAvisos();
        const socket = "ws://127.0.0.1:1/otro/";
        const primero = nuevo(socket, {"x-mr-heartbeat": "a"});
        assert.equal(avisos.length, 0);

        assert.equal(nuevo(socket, {"x-mr-heartbeat": "a"}), primero);
        assert.equal(avisos.length, 0, "mismas cabeceras: sin aviso");

        assert.equal(nuevo(socket, {"x-mr-heartbeat": "b"}), primero);
        assert.equal(nuevo(socket, {"x-mr-heartbeat": "c"}), primero);
        assert.equal(nuevo(socket), primero);
        assert.equal(avisos.length, 1);
        assert.ok(!avisos[0]!.includes("\"b\"") && !avisos[0]!.includes("x-mr-heartbeat: b"), "el aviso no debe incluir valores");
    });
});
