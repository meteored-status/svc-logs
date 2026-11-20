/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: 1879d11aa5a63237c03b1793e64fadb3
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {crearServidor, esperarHasta, type IServidorPrueba} from "./helpers";

import {afterEach, describe, it} from "node:test";
import assert from "node:assert/strict";
import {WebSocket as WS} from "ws";

/**
 * `shutdown()` del servidor WebSocket con un servidor real: el `Shutdown` llega repartido con muchos clientes
 * y a la vez con pocos.
 */

let servidor: IServidorPrueba|undefined;
const sockets: WS[] = [];

interface ICliente {
    ws: WS;
    shutdown: number|undefined;
}

/** Abre `n` clientes que, al recibir `Shutdown`, anotan la hora y cierran. */
const abrirClientes = async (puerto: number, n: number): Promise<ICliente[]> => {
    const clientes: ICliente[] = [];
    await Promise.all(Array.from({length: n}, async () => {
        const ws = new WS(`ws://127.0.0.1:${puerto}/`);
        sockets.push(ws);
        const cliente: ICliente = {ws, shutdown: undefined};
        clientes.push(cliente);
        ws.on("message", (raw) => {
            const msg = JSON.parse(raw.toString()) as {ok: boolean; info?: {message: string}};
            if (!msg.ok && msg.info?.message === "Shutdown") {
                cliente.shutdown = Date.now();
                ws.close();
            }
        });
        await new Promise<void>((resolve, reject) => {
            ws.once("message", () => resolve());
            ws.once("error", reject);
        });
    }));

    return clientes;
};

afterEach(async () => {
    for (const ws of sockets.splice(0)) {
        ws.terminate();
    }
    await servidor?.cerrar();
    servidor = undefined;
});

describe("shutdown() del servidor WebSocket", () => {
    it("con 60 clientes reparte el Shutdown en la ventana y acaba antes de timeoutMs", async () => {
        servidor = await crearServidor([]);
        const clientes = await abrirClientes(servidor.puerto, 60);
        await esperarHasta(() => (servidor!.ws as unknown as {clientes: Map<unknown, unknown>}).clientes.size === 60);

        // 60 clientes a 40/s = 1500 ms (cabe en 8000 - 5000 - 1000 = 2000)
        const t0 = Date.now();
        await servidor.ws.shutdown(8000);
        const total = Date.now() - t0;

        const horas = clientes.map(c => c.shutdown);
        assert.ok(horas.every(h => h !== undefined), "algún cliente no recibió el Shutdown");
        const tiempos = horas as number[];
        const reparto = Math.max(...tiempos) - Math.min(...tiempos);
        assert.ok(reparto >= 0.8 * 1500, `el Shutdown llegó en ${reparto} ms, no repartido`);
        assert.ok(total < 8000, `shutdown() tardó ${total} ms`);
    });

    it("durante la ventana, el cliente al que aún no le ha tocado conserva su intervalo de Alive", async () => {
        servidor = await crearServidor([]);
        await abrirClientes(servidor.puerto, 60);
        const mapa = (servidor.ws as unknown as {clientes: Map<unknown, {timer?: unknown}>}).clientes;
        await esperarHasta(() => mapa.size === 60);

        const apagado = servidor.ws.shutdown(8000);
        await new Promise<void>(resolve => setTimeout(resolve, 300));
        const conLiveness = [...mapa.values()].filter(c => c.timer !== undefined).length;
        await apagado;

        // a los 300 ms de una ventana de 1500 ms han recibido su Shutdown unos 12: los demás siguen con su intervalo
        assert.ok(conLiveness > 0, "se borró el liveness de todos al empezar el apagado");
        assert.ok(conLiveness < 60, "nadie había recibido su Shutdown");
    });

    it("con 10 clientes todos lo reciben a la vez, como antes", async () => {
        servidor = await crearServidor([]);
        const clientes = await abrirClientes(servidor.puerto, 10);
        await esperarHasta(() => (servidor!.ws as unknown as {clientes: Map<unknown, unknown>}).clientes.size === 10);

        await servidor.ws.shutdown(8000);

        const tiempos = clientes.map(c => c.shutdown);
        assert.ok(tiempos.every(h => h !== undefined));
        const reparto = Math.max(...(tiempos as number[])) - Math.min(...(tiempos as number[]));
        assert.ok(reparto < 100, `el Shutdown se repartió ${reparto} ms con pocos clientes`);
    });
});
