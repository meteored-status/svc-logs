/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: b1dda017517735ffd5215d010a9c64d4
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import os from "node:os";

import {PRESUPUESTO_ANTES_DE_SALIR_MS, SHUTDOWN_TIMEOUT_PRODUCCION_MS} from "@mr/core-network/server/http/config/net";
import {Deferred} from "services-comun/modules/utiles/promise";
import {info, warning} from "services-comun/modules/utiles/log";

import {margenPendienteMs} from "../engine/lock";

/**
 * Tiempo máximo (ms) que el primario espera a que salgan los workers, **sin contar el margen de endpoints**, que se le
 * suma (ver {@link cerrarPrimario}). Los workers cierran con el `shutdownTimeout` del servidor HTTP (18 s en producción)
 * más el segundo de `antesDeSalir`; con el margen de hasta 3 s desde el `shutdown.lock`, la despedida del primario y la
 * salida caben en los 25 s de `terminationGracePeriodSeconds`.
 */
export const ESPERA_WORKERS_MS = SHUTDOWN_TIMEOUT_PRODUCCION_MS + PRESUPUESTO_ANTES_DE_SALIR_MS;

/**
 * Tope de la despedida del primario (`parado`, vaciar y destruir el pool), como el presupuesto de 1 s de `antesDeSalir` de los
 * servidores. `despedir()` se espera al contexto y reconecta (hasta unos 5 s): sin tope, 19 s de espera a los workers más eso, más el
 * margen de 3 s, pasarían de los 25 s de gracia. Con él, el peor caso es 3 s + 19 s + 1 s = 23 s, con 2 s de margen para el `salir`.
 */
export const DESPEDIDA_MAX_MS = 1000;

/**
 * Lo que el cierre del primario necesita de un worker (el `Worker` de `node:cluster` encaja con un adaptador fino).
 *
 * @property haSalido - Si el proceso ya ha terminado.
 * @property alSalir - Registra un callback para cuando termine.
 * @property enviarSenal - Le manda la señal al proceso.
 */
export interface IWorkerCierre {
    haSalido(): boolean;
    alSalir(cb: () => void): void;
    enviarSenal(senal: NodeJS.Signals): void;
}

/**
 * Lo que el cierre del primario necesita del emisor del heartbeat.
 *
 * @property alIniciarCierre - Marca el cierre por señal: el siguiente heartbeat dirá `drenando`.
 * @property despedir - Manda `parado`, vacía el pool y lo destruye.
 */
export interface IEmisorCierre {
    alIniciarCierre(): void;
    despedir(): Promise<void>;
}

/**
 * Configuración de {@link cerrarPrimario}.
 *
 * @property senal - Señal recibida, que se reenvía a los workers.
 * @property workers - Workers vivos del primario.
 * @property emisor - Emisor del heartbeat agregado, o `null` si el heartbeat no está habilitado (no hay `drenando` ni despedida).
 * @property salir - Termina el proceso con el código dado. Por defecto `process.exit`.
 * @property esperaMs - Tiempo máximo de espera a los workers, sin el margen. Por defecto {@link ESPERA_WORKERS_MS}.
 * @property despedidaMs - Tiempo máximo de la despedida. Por defecto {@link DESPEDIDA_MAX_MS}.
 * @property margen - Lo que falta del margen de endpoints en ms; se suma a la espera. Por defecto {@link margenPendienteMs}.
 */
export interface IConfigCierrePrimario {
    senal: NodeJS.Signals;
    workers: IWorkerCierre[];
    emisor: IEmisorCierre|null;
    salir?: (codigo: number) => void;
    esperaMs?: number;
    despedidaMs?: number;
    margen?: () => Promise<number>;
}

/**
 * Cierre del primario de un cluster cuando recibe `SIGTERM`/`SIGINT`, con o sin heartbeat:
 *
 * 1. Con heartbeat, marca el cierre en el emisor (pasa a `drenando` con causa `senal` sin esperar a los workers).
 * 2. Reenvía la señal a cada worker vivo, que cierra con su propio servidor HTTP (cada uno calcula su margen de
 *    endpoints con el mismo `shutdown.lock`).
 * 3. Espera a que salgan todos, como mucho el margen pendiente más `esperaMs`.
 * 4. Con heartbeat, despide: manda `parado`, vacía el pool y lo destruye, como mucho `despedidaMs`.
 * 5. Sale con 0.
 *
 * Sin esto, el primario moría al instante con la señal por defecto —dejando workers huérfanos— y, con heartbeat, el
 * receptor nunca veía `drenando` ni `parado`. Nunca rechaza.
 */
export async function cerrarPrimario({senal, workers, emisor, salir = (codigo) => process.exit(codigo), esperaMs = ESPERA_WORKERS_MS, despedidaMs = DESPEDIDA_MAX_MS, margen = margenPendienteMs}: IConfigCierrePrimario): Promise<void> {
    try {
        emisor?.alIniciarCierre();
    } catch (err) {
        warning("Error marcando el cierre del heartbeat", err);
    }

    const salidas = workers.map((worker) => {
        const salida = new Deferred<void>();
        if (worker.haSalido()) {
            salida.resolve();

            return salida.promise;
        }
        worker.alSalir(() => { salida.resolve(); });
        try {
            worker.enviarSenal(senal);
        } catch (err) {
            warning("No se pudo reenviar la señal a un worker", err);
            salida.resolve();
        }

        return salida.promise;
    });

    let margenMs = 0;
    try {
        margenMs = await margen();
    } catch (err) {
        warning("Error calculando el margen de endpoints", err);
    }
    const esperaTotalMs = margenMs + esperaMs;
    const vencido = new Deferred<boolean>();
    const timer = setTimeout(() => { vencido.resolve(true); }, esperaTotalMs);
    timer.unref();
    void Promise.all(salidas).then(() => { vencido.resolve(false); });
    if (await vencido.promise) {
        warning(`Los workers no salieron en ${esperaTotalMs} ms; se despide el pod igualmente`);
    }
    clearTimeout(timer);

    await despedirAcotado(emisor, despedidaMs);
    salir(0);
}

/**
 * Despide el pod con el emisor (si lo hay), como mucho `despedidaMs`: pasado el tope se avisa y se sigue. Nunca rechaza.
 *
 * @param emisor - Emisor del heartbeat, o `null` (no hace nada).
 * @param despedidaMs - Tope en ms. Por defecto {@link DESPEDIDA_MAX_MS}.
 */
export async function despedirAcotado(emisor: IEmisorCierre|null, despedidaMs: number = DESPEDIDA_MAX_MS): Promise<void> {
    if (emisor === null) {
        return;
    }
    const despedida = new Deferred<void>();
    const timerDespedida = setTimeout(() => {
        warning(`La despedida del heartbeat no terminó en ${despedidaMs} ms; se sale igualmente`);
        despedida.resolve();
    }, despedidaMs);
    timerDespedida.unref();
    try {
        await Promise.race([emisor.despedir(), despedida.promise]);
    } catch (err) {
        warning("Error en la despedida del heartbeat", err);
    }
    clearTimeout(timerDespedida);
}

/**
 * Configuración de {@link instalarCierrePrimario}.
 *
 * @property workers - Workers vivos en el momento de la señal.
 * @property emisor - Emisor del heartbeat agregado, o `null` si no está habilitado.
 * @property salir - Termina el proceso con el código dado. Por defecto `process.exit`.
 */
export interface IConfigInstalarCierre {
    workers: () => IWorkerCierre[];
    emisor: IEmisorCierre|null;
    salir?: (codigo: number) => void;
}

/**
 * Instala en el primario el manejador de `SIGTERM` y `SIGINT` que ejecuta {@link cerrarPrimario}. La primera señal inicia
 * el cierre; una segunda, de cualquiera de las dos, sale ya con `128 + n` (143 con `SIGTERM`, 130 con `SIGINT`), como
 * {@link instalarApagado} en el resto de procesos. Devuelve la función que quita los manejadores (para las pruebas).
 */
export function instalarCierrePrimario({workers, emisor, salir = (codigo) => process.exit(codigo)}: IConfigInstalarCierre): () => void {
    let cerrando = false;
    const alSenal = (senal: NodeJS.Signals): void => {
        if (cerrando) {
            info(`Recibida señal ${senal} (repetida) en el primario; saliendo ya`);
            salir(128 + (os.constants.signals[senal] ?? 0));

            return;
        }
        cerrando = true;
        info(`Recibida señal ${senal} en el primario; cerrando los workers`);
        void cerrarPrimario({senal, workers: workers(), emisor, salir});
    };
    process.on("SIGTERM", alSenal);
    process.on("SIGINT", alSenal);

    return () => {
        process.off("SIGTERM", alSenal);
        process.off("SIGINT", alSenal);
    };
}
