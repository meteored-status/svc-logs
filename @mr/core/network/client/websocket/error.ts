/**
 * Error de caída de red (distinto de timeout). Se usa como señal interna para
 * que el circuit breaker distinga entre un servidor lento (timeout) y uno caído
 * (conexión rechazada o reconexiones agotadas).
 *
 * No se exporta desde el entrypoint del paquete: es un detalle de implementación
 * del pool de conexiones.
 */
export class WSConnectionError extends Error {
    public constructor(message: string) {
        super(message);
        this.name = "WSConnectionError";
        Object.setPrototypeOf(this, WSConnectionError.prototype);
    }
}

