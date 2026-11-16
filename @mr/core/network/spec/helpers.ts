/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 177d8a9256845791a3c5cb3349f811d4
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import http from "node:http";
import type {AddressInfo} from "node:net";

import wsServer, {type WebSocket as WSServer} from "../server/websocket/index";
import type {IWSHandler} from "../server/websocket/handler";

/** Servidor HTTP + WebSocket local en un puerto libre, sin servicios externos. */
export interface IServidorPrueba {
    puerto: number;
    ws: WSServer;
    cerrar(): Promise<void>;
}

export async function crearServidor(handlers: IWSHandler[]): Promise<IServidorPrueba> {
    const servidor = http.createServer();
    await new Promise<void>(resolve => servidor.listen(0, "127.0.0.1", resolve));
    const ws = wsServer(servidor, handlers);

    return {
        puerto: (servidor.address() as AddressInfo).port,
        ws,
        cerrar: async () => {
            await ws.shutdown(500);
            servidor.closeAllConnections();
            await new Promise<void>(resolve => servidor.close(() => resolve()));
        },
    };
}

/** Espera hasta que `condicion` se cumple o vence `ms`. */
export async function esperarHasta(condicion: () => boolean, ms = 2000): Promise<void> {
    const limite = Date.now() + ms;
    while (!condicion() && Date.now() < limite) {
        await new Promise<void>(resolve => setTimeout(resolve, 5));
    }
}
