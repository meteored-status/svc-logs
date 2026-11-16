/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: ebd9a108ac841b71ebe33fdbbcaf040f
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {IMessage} from "../eventos";

// Interfaz global que define los métodos que debe tener cada transporte que lo defina.
export interface ITransporte {
    emit(name: string, message: IMessage): void;
    listen(name: string, callback: (message: IMessage) => void, signal?: AbortSignal): void;
}
