/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 88023eed1335c9bca869fc1ce8158539
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {IMessage} from "../../eventos";
import type {ITransporte} from "../transporte";

/**
 * Transporte por eventos del DOM sobre cualquier `EventTarget`: el mensaje viaja como el `detail` de un `CustomEvent`. Se usa con `window`, `document`,
 * uno propio de la aplicación (`app`) o cualquier otro `EventTarget`.
 */
export class TransporteEventoDom implements ITransporte {
    /* INSTANCE */
    private readonly destino: EventTarget;

    public constructor(destino: EventTarget) {
        this.destino = destino;
    }

    /**
     * Emite el evento `name`, con `message` en su `detail`.
     */
    public emit(name: string, message: IMessage): void {
        this.destino.dispatchEvent(new CustomEvent(name, {detail: message, bubbles: true, composed: true}));
    }

    /**
     * Escucha el evento `name`. Para dejar de escuchar se pasa un `AbortSignal`.
     */
    public listen(name: string, callback: (message: IMessage) => void, signal?: AbortSignal): void {
        this.destino.addEventListener(name, (evento) => {
            callback((evento as CustomEvent<IMessage>).detail);
        }, {signal});
    }
}
