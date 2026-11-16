/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: cb075da14a7085341e4e1d4c74454fa6
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import os from "node:os";

import {SHUTDOWN_TIMEOUT_DESARROLLO_MS, SHUTDOWN_TIMEOUT_PRODUCCION_MS} from "@mr/core-network/server/http/config/net";
import {Deferred} from "services-comun/modules/utiles/promise";
import {info, warning} from "services-comun/modules/utiles/log";

import {type IEmisorCierre, despedirAcotado} from "../heartbeat/cierre-primario";

/**
 * Lo que el cierre por señal necesita del engine.
 *
 * @property apagadoPorServidor - Si el servidor HTTP del proceso ya atiende la señal.
 * @property solicitarApagado - Aborta y ejecuta `shutdown()` una sola vez; nunca rechaza.
 */
export interface IEngineApagable {
    readonly apagadoPorServidor: boolean;
    solicitarApagado(motivo: string): Promise<void>;
}

/**
 * Configuración de {@link atenderSenal}.
 *
 * @property senal - Señal recibida.
 * @property repetida - Si ya se había recibido una señal de cierre antes.
 * @property engine - Engine del proceso, o `null` si aún no se ha construido.
 * @property ejecucionPendiente - Si el proceso es de ejecución finita (cronjob/job) y `ejecutar()` sigue en marcha.
 * @property emisor - Emisor del heartbeat, o `null`.
 * @property esperaMs - Plazo máximo del `shutdown()` del engine en un proceso sin HTTP (y, en desarrollo, en un cronjob).
 * @property produccion - Si corre en producción. Fuera de ella un cronjob también sale tras la señal (ver {@link atenderSenal}).
 * @property salir - Termina el proceso con el código dado.
 */
export interface IConfigSenal {
    senal: NodeJS.Signals;
    repetida: boolean;
    engine: IEngineApagable|null;
    ejecucionPendiente: boolean;
    emisor: IEmisorCierre|null;
    esperaMs: number;
    produccion: boolean;
    salir: (codigo: number) => void;
}

/** Plazo del `shutdown()` del engine en un proceso sin servidor HTTP: el `shutdownTimeout` del servidor, según el entorno. */
export const esperaApagadoMs = (): number => global.PRODUCCION ? SHUTDOWN_TIMEOUT_PRODUCCION_MS : SHUTDOWN_TIMEOUT_DESARROLLO_MS;

/**
 * Atiende `SIGTERM`/`SIGINT` en un proceso que no es el primario de un cluster:
 *
 * - **Señal repetida**, o llegada antes de que exista el engine: sale ya con `128 + n` (143 con `SIGTERM`, 130 con `SIGINT`).
 * - **El servidor HTTP la atiende** (`apagadoPorServidor`): no hace nada, el servidor cierra y sale.
 * - **Ejecución finita en marcha** (cronjob/job): pide el apagado (aborta y `shutdown()`). En **producción no sale**: el
 *   proceso termina cuando acaba `ejecutar()`, por el camino normal de {@link Main}, o por `SIGKILL`. **Fuera de
 *   producción** sale tras el `shutdown()` con tope `esperaMs` (2 s) y código `128 + n`: `node --watch` (`g:devel`) manda
 *   `SIGTERM` al guardar y espera sin tope, y un cronjob que no mira `abortSignal` no se reiniciaría nunca.
 * - **Resto** (proceso sin HTTP de larga vida): avisa al heartbeat, pide el apagado con tope `esperaMs`, se despide
 *   (como mucho 1 s) y sale con 0.
 *
 * Nunca rechaza.
 */
export async function atenderSenal({senal, repetida, engine, ejecucionPendiente, emisor, esperaMs, produccion, salir}: IConfigSenal): Promise<void> {
    const codigo = 128 + (os.constants.signals[senal] ?? 0);
    if (engine?.apagadoPorServidor === true && !repetida) {
        // La atiende el servidor HTTP, que ya la deja en el log: no se duplica.
        return;
    }
    info(`Recibida señal ${senal}${repetida ? " (repetida)" : ""}`);
    if (repetida || engine === null) {
        salir(codigo);

        return;
    }
    if (ejecucionPendiente && produccion) {
        await engine.solicitarApagado(`Recibida señal ${senal}`);

        return;
    }

    try {
        emisor?.alIniciarCierre();
    } catch (err) {
        warning("Error marcando el cierre del heartbeat", err);
    }
    const vencido = new Deferred<boolean>();
    const timer = setTimeout(() => { vencido.resolve(true); }, esperaMs);
    timer.unref();
    void engine.solicitarApagado(`Recibida señal ${senal}`).then(() => { vencido.resolve(false); });
    if (await vencido.promise) {
        warning(`El shutdown del engine no terminó en ${esperaMs} ms; se sale igualmente`);
    }
    clearTimeout(timer);
    await despedirAcotado(emisor);
    salir(ejecucionPendiente ? codigo : 0);
}

/**
 * Configuración de {@link instalarApagado}.
 *
 * @property estado - Estado del proceso en el momento de la señal.
 * @property salir - Termina el proceso. Por defecto `process.exit`.
 * @property produccion - Si corre en producción. Por defecto `PRODUCCION`.
 */
export interface IConfigInstalarApagado {
    estado: () => Pick<IConfigSenal, "engine" | "ejecucionPendiente" | "emisor">;
    salir?: (codigo: number) => void;
    produccion?: boolean;
}

/**
 * Instala el manejador de `SIGTERM` y `SIGINT` que ejecuta {@link atenderSenal}. Una segunda señal, de cualquiera
 * de las dos, sale ya. Devuelve la función que quita los manejadores (para las pruebas).
 */
export function instalarApagado({estado, salir = (codigo) => process.exit(codigo), produccion = global.PRODUCCION}: IConfigInstalarApagado): () => void {
    let recibidas = 0;
    const alSenal = (senal: NodeJS.Signals): void => {
        const repetida = recibidas > 0;
        recibidas++;
        void atenderSenal({senal, repetida, ...estado(), esperaMs: esperaApagadoMs(), produccion, salir});
    };
    process.on("SIGTERM", alSenal);
    process.on("SIGINT", alSenal);

    return () => {
        process.off("SIGTERM", alSenal);
        process.off("SIGINT", alSenal);
    };
}
