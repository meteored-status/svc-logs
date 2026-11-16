/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 8250fc772ee1c098d0546414802e216f
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Lo que necesita el emisor del `Server` de `@mr/core-network/server/http/server` (su singleton
 * encaja tal cual; se declara aquí para no importar el servidor entero).
 *
 * @property isShuttingDown - Si el servidor ya está cerrando.
 * @property alIniciarCierre - Registra un callback síncrono al empezar el cierre por señal.
 * @property antesDeSalir - Registra un callback asíncrono tras `close()` y antes de `process.exit`.
 */
export interface IServidorCierre {
    isShuttingDown(): boolean;
    alIniciarCierre(cb: () => void): void;
    antesDeSalir(cb: () => Promise<void>): void;
}

/**
 * Lo que `Main` y el engine HTTP usan del emisor del heartbeat, sea el de un pod simple, el primario de un
 * cluster o un worker.
 *
 * @property setEngine - Pasa la instancia del engine en cuanto existe (la sonda de salud sale de ella).
 * @property marcarEjecutado - `engine.ejecutar()` ha resuelto.
 * @property disparar - Fuerza una evaluación y un envío inmediatos (cambió algo relevante).
 * @property enlazarServidor - Engancha el cierre por señal del servidor HTTP: aviso de `drenando` y despedida `parado`.
 */
export interface IInstanciaHeartbeat {
    setEngine(engine: object): void;
    marcarEjecutado(): void;
    disparar(): void;
    enlazarServidor(servidor: IServidorCierre): void;
}

let actual: IInstanciaHeartbeat|null = null;

/**
 * Registra la instancia del proceso para que la encuentre el engine HTTP, que se construye después y
 * no recibe nada de `Main`.
 */
export function registrarHeartbeat(instancia: IInstanciaHeartbeat|null): void {
    actual = instancia;
}

/**
 * La instancia del heartbeat de este proceso, o `null` si no emite.
 */
export function heartbeatActual(): IInstanciaHeartbeat|null {
    return actual;
}
