/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: 03760592c8d5e0133e16f60cb87b9291
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {after, describe, it} from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type {AddressInfo} from "node:net";
import type {Duplex} from "node:stream";

import {WSPool} from "../../network/client/websocket";
import {type IRelojDespedida, despedirConfirmado} from "../heartbeat/despedida";
import {type IHeartbeat, METODO_HEARTBEAT, METODO_HEARTBEAT_CONFIRMADO} from "../heartbeat/interface";
import {adaptarPool} from "../heartbeat/pool";

/**
 * La despedida contra un servidor WebSocket de verdad (un `http.Server` con el protocolo escrito a mano: el workspace no depende
 * de `ws`) y el `WSPool` real de `@mr/core-network`. Comprueba lo que los dobles no pueden: que un receptor anterior contesta
 * `ok: false` al momento, que `head()` de reserva llega y que el segundo intento va por **otra conexión**.
 */

const MENSAJE = {seq: 7, estado: "parado", tseq: 3, pod: "pod-1"} as unknown as IHeartbeat;

interface IPeticion {
    conexion: number;
    metodo: string;
    head: boolean;
    params: IHeartbeat;
}

type TComportamiento = (peticion: IPeticion, responder: (mensaje: object) => void) => void;

/** Un servidor WebSocket mínimo: cada conexión lleva un número, y cada petición se entrega al comportamiento. */
class ServidorFalso {
    public readonly peticiones: IPeticion[] = [];
    public conexiones = 0;
    public url = "";

    private readonly http: http.Server;
    private readonly sockets: Duplex[] = [];

    public constructor(comportamiento: TComportamiento) {
        this.http = http.createServer();
        this.http.on("upgrade", (req, socket: Duplex) => {
            const conexion = this.conexiones++;
            this.sockets.push(socket);
            const clave = crypto.createHash("sha1").update(`${req.headers["sec-websocket-key"]}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
            socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${clave}\r\n\r\n`);

            let pendiente = Buffer.alloc(0);
            socket.on("data", (trozo: Buffer) => {
                pendiente = Buffer.concat([pendiente, trozo]);
                for (;;) {
                    const trama = ServidorFalso.leerTrama(pendiente);
                    if (trama === null) {
                        return;
                    }
                    pendiente = pendiente.subarray(trama.consumido);
                    if (trama.opcode === 8) {
                        socket.end(Buffer.from([0x88, 0x00]));

                        return;
                    }
                    if (trama.opcode !== 1) {
                        continue;
                    }
                    const mensaje = JSON.parse(trama.texto) as {id: string; method: string; head?: boolean; params: IHeartbeat};
                    const peticion: IPeticion = {conexion, metodo: mensaje.method, head: mensaje.head === true, params: mensaje.params};
                    this.peticiones.push(peticion);
                    comportamiento(peticion, (respuesta) => { socket.write(ServidorFalso.tramaTexto(JSON.stringify({id: mensaje.id, ...respuesta}))); });
                }
            });
            socket.on("error", () => undefined);
        });
    }

    private static leerTrama(buffer: Buffer): {opcode: number; texto: string; consumido: number}|null {
        if (buffer.length < 2) {
            return null;
        }
        const opcode = buffer[0]! & 0x0f;
        let largo = buffer[1]! & 0x7f;
        let posicion = 2;
        if (largo === 126) {
            if (buffer.length < 4) {
                return null;
            }
            largo = buffer.readUInt16BE(2);
            posicion = 4;
        } else if (largo === 127) {
            throw new Error("trama demasiado grande para la prueba");
        }
        const enmascarada = (buffer[1]! & 0x80) !== 0;
        const mascara = enmascarada ? buffer.subarray(posicion, posicion + 4) : null;
        posicion += enmascarada ? 4 : 0;
        if (buffer.length < posicion + largo) {
            return null;
        }
        const carga = Buffer.from(buffer.subarray(posicion, posicion + largo));
        if (mascara !== null) {
            for (let i = 0; i < carga.length; i++) {
                carga[i] = carga[i]! ^ mascara[i % 4]!;
            }
        }

        return {opcode, texto: carga.toString("utf8"), consumido: posicion + largo};
    }

    private static tramaTexto(texto: string): Buffer {
        const carga = Buffer.from(texto, "utf8");
        const cabecera = carga.length < 126 ? Buffer.from([0x81, carga.length]) : Buffer.from([0x81, 126, carga.length >> 8, carga.length & 0xff]);

        return Buffer.concat([cabecera, carga]);
    }

    public async iniciar(): Promise<void> {
        await new Promise<void>((resolve) => { this.http.listen(0, "127.0.0.1", resolve); });
        this.url = `ws://127.0.0.1:${(this.http.address() as AddressInfo).port}/status/external/heartbeat/`;
    }

    public async parar(): Promise<void> {
        for (const socket of this.sockets) {
            socket.destroy();
        }
        await new Promise<void>((resolve) => { this.http.close(() => { resolve(); }); });
    }
}

const REQUEST_TIMEOUT_MS = 400;

/** Un emisor contra `url`: el pool caliente y la fábrica de pools nuevos, como en `crear.ts`. */
function emisorHacia(url: string) {
    const base = {socket: url, minConnections: 1, requestTimeoutMs: REQUEST_TIMEOUT_MS, heartbeatTimeoutMs: 25_000};

    return {
        pool: adaptarPool(WSPool.get(base)),
        abrirNuevo: () => adaptarPool(WSPool.get({...base, reconnect: false})),
    };
}

const RELOJ: IRelojDespedida = {
    ahora: () => Date.now(),
    temporizador: (ms) => {
        let timer: NodeJS.Timeout|undefined;
        const promesa = new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); });

        return {promesa, cancelar: () => { clearTimeout(timer); }};
    },
};

const CONFIRMADO = {ok: true, done: true, buffer: false, data: {v: 1, resultado: "confirmado"}};

describe("despedida contra un servidor WebSocket real", () => {
    const servidores: ServidorFalso[] = [];
    after(async () => {
        for (const servidor of servidores) {
            await servidor.parar();
        }
    });

    async function levantar(comportamiento: TComportamiento): Promise<ServidorFalso> {
        const servidor = new ServidorFalso(comportamiento);
        servidores.push(servidor);
        await servidor.iniciar();

        return servidor;
    }

    it("receptor nuevo: confirma al primer intento", async () => {
        const servidor = await levantar((_peticion, responder) => { responder(CONFIRMADO); });
        const informe = await despedirConfirmado({...emisorHacia(servidor.url), mensaje: MENSAJE, reloj: RELOJ});
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 1);
        assert.equal(servidor.peticiones.length, 1);
        assert.equal(servidor.peticiones[0]?.metodo, METODO_HEARTBEAT_CONFIRMADO);
        assert.equal(servidor.peticiones[0]?.head, false);
        assert.equal(servidor.peticiones[0]?.params.seq, 7);
    });

    it("receptor anterior: ok:false al momento, el head de reserva llega con el mismo parado y todo cabe en 100 ms", async () => {
        const servidor = await levantar((peticion, responder) => {
            if (peticion.metodo !== METODO_HEARTBEAT) {
                responder({ok: false, info: {message: `No handler for method ${peticion.metodo}`}});
            }
        });
        const t0 = Date.now();
        const informe = await despedirConfirmado({...emisorHacia(servidor.url), mensaje: MENSAJE, reloj: RELOJ});
        const ms = Date.now() - t0;
        assert.equal(informe.resultado, "reserva");
        assert.equal(informe.intentos, 1);
        assert.ok(ms < 100, `tardó ${ms} ms`);
        assert.deepEqual(servidor.peticiones.map((p) => [p.metodo, p.head]), [[METODO_HEARTBEAT_CONFIRMADO, false], [METODO_HEARTBEAT, true]]);
        assert.equal(servidor.peticiones[1]?.params.seq, 7);
        assert.equal(servidor.peticiones[1]?.params.estado, "parado");
    });

    it("receptor que calla en la primera petición: el segundo intento llega por otro socket y confirma", async () => {
        // La primera petición se queda sin respuesta, sea cual sea su conexión (el pool abre una al crearse y otra si la pide antes de que esté lista).
        let primera: IPeticion|undefined;
        const servidor = await levantar((peticion, responder) => {
            primera ??= peticion;
            if (peticion !== primera) {
                responder(CONFIRMADO);
            }
        });
        const informe = await despedirConfirmado({...emisorHacia(servidor.url), mensaje: MENSAJE, intentoMs: 120, reloj: RELOJ});
        assert.equal(informe.resultado, "confirmado");
        assert.equal(informe.intentos, 2);
        assert.equal(servidor.peticiones.length, 2);
        assert.notEqual(servidor.peticiones[0]?.conexion, servidor.peticiones[1]?.conexion, "el reintento no reutiliza el socket del primero");
        assert.equal(servidor.peticiones[0]?.params.seq, servidor.peticiones[1]?.params.seq, "es el mismo parado");
    });

    it("receptor que acepta la conexión y no contesta: el motivo dice que había conexión, en los dos intentos", async () => {
        const servidor = await levantar(() => undefined);
        const informe = await despedirConfirmado({...emisorHacia(servidor.url), mensaje: MENSAJE, intentoMs: 120, presupuestoMs: 400, reloj: RELOJ});
        assert.equal(informe.resultado, "sin-confirmar");
        assert.equal(informe.intentos, 2);
        assert.match(informe.motivo ?? "", /^intento 1: sin respuesta en 120 ms \(había conexión desde los \d+ ms\); intento 2: sin respuesta en \d+ ms \(había conexión desde los \d+ ms\)$/);
        assert.equal(servidor.peticiones.length >= 2, true, "las dos peticiones llegaron al servidor: había conexión de verdad");
    });
});
