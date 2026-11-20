/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: 32fe21de6b6716b0b92be83f4a77fbb9
 * Versión: 2026.11.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {error as registrarError} from "services-comun/modules/utiles/log";

import type {IResultadoDespedida} from "./emisor";

/**
 * Lo que el final de una carga finita necesita del emisor del heartbeat.
 *
 * @property despedir - Manda `parado` con el resultado de la ejecución y destruye los pools. Nunca rechaza.
 */
export interface IEmisorFinita {
    despedir(ejecucion: IResultadoDespedida): Promise<void>;
}

/**
 * Lo que un arranque fallido necesita del emisor del heartbeat.
 *
 * @property esperarPrimerEnvio - Espera como mucho `maxMs` a que salga el primer envío.
 */
export interface IEmisorPrimerEnvio {
    esperarPrimerEnvio(maxMs: number): Promise<void>;
}

/**
 * Configuración de {@link terminarEjecucionFinita}.
 *
 * @property emisor - Emisor del heartbeat, o `null` si el pod no emite.
 * @property ejecucion - Cómo acabó la ejecución.
 * @property stopSidecar - Detiene el sidecar de Istio. No rechaza.
 * @property salir - Termina el proceso con el código dado.
 */
export interface IConfigTerminarFinita {
    emisor: IEmisorFinita|null;
    ejecucion: IResultadoDespedida;
    stopSidecar: () => Promise<void>;
    salir: (codigo: number) => void;
}

/**
 * Resultado `error` de una ejecución que ha fallado: solo `err.name`, nunca el mensaje (puede llevar datos). Un valor que no es un
 * `Error` se nombra por su tipo; si no tiene nombre, `Error`.
 */
export function resultadoDeError(err: unknown): IResultadoDespedida {
    const nombre = err instanceof Error ? err.name : typeof err;

    return {resultado: "error", error: nombre.length > 0 ? nombre : "Error"};
}

/**
 * Final de una carga finita (cronjob o job), por el camino normal y por el de un fallo, en este orden: **despedida del heartbeat, parada del
 * sidecar de Istio y salida**. El sidecar se para después porque la despedida va por la red, que sin él no sale. La salida es siempre
 * con código 0 (el Job no consta como fallido aunque la ejecución sí: lo cuenta el heartbeat), también si algo de lo anterior falla.
 */
export async function terminarEjecucionFinita({emisor, ejecucion, stopSidecar, salir}: IConfigTerminarFinita): Promise<void> {
    try {
        await emisor?.despedir(ejecucion);
    } catch (err) {
        registrarError("Error despidiendo el heartbeat de la ejecución", err);
    }
    try {
        await stopSidecar();
    } finally {
        salir(0);
    }
}

/**
 * Antes de que un arranque fallido salga del proceso: deja que el primer latido (`arrancando`) llegue al receptor, con un tope de
 * `maxMs`. Sin emisor (heartbeat desactivado, o un worker) no hace nada. Nunca rechaza ni cambia el código de salida, que decide quien llama.
 */
export async function esperarPrimerEnvio(emisor: IEmisorPrimerEnvio|null, maxMs: number): Promise<void> {
    try {
        await emisor?.esperarPrimerEnvio(maxMs);
    } catch (err) {
        registrarError("Error esperando el primer envío del heartbeat", err);
    }
}
