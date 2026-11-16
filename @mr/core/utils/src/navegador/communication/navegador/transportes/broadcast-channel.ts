/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 99183c3b6545d03318401dbe66d1c646
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {IMessage} from "../../eventos";
import type {ITransporte} from "../transporte";

/**
 * Transporte vía BroadCastChannel entre pestañas.
 */
export class TransporteBroadcastChannel implements ITransporte {
    /* INSTANCE */
    private readonly canales: Map<string, BroadcastChannel>;

    public constructor() {
        this.canales = new Map();
    }

    /**
     * Envía `message` a las demás pestañas por el canal `name`.
     */
    public emit(name: string, message: IMessage): void {
        this.canal(name)?.postMessage(message);
    }

    /**
     * Escucha el canal `name`. Para dejar de escuchar se pasa un `AbortSignal`.
     */
    public listen(name: string, callback: (message: IMessage) => void, signal?: AbortSignal): void {
        this.canal(name)?.addEventListener("message", ({data}: MessageEvent<IMessage>) => {
            callback({...data, origin: `remoto:${data.origin}`});
        }, {signal});
    }

    private canal(name: string): BroadcastChannel | undefined {
        if (typeof BroadcastChannel === "undefined") {
            return undefined;
        }
        let canal = this.canales.get(name);
        if (!canal) {
            canal = new BroadcastChannel(name);
            this.canales.set(name, canal);
        }

        return canal;
    }
}
