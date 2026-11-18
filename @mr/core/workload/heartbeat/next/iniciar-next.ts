/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 14:36:40 GMT
 * Hash: 4458acf9b8aebfef78e577aeff527ebb
 * Versión: 2026.11.16+3-bixus
 * Anterior: 2026.11.16+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {warning} from "services-comun/modules/utiles/log";

import type {IServidorCierre} from "../registro";
import {AdaptadorNext, type IConfigAdaptadorNext} from "./sonda-next";
import {type IProcesoCierre, ServidorCierreNext} from "./cierre-next";

/**
 * Clave, en `globalThis`, de la guarda de {@link iniciarHeartbeatNextCon}: sobrevive a la reevaluación de módulos (HMR, doble
 * carga de la instrumentación en `next dev`), que reiniciaría una variable de módulo.
 */
export const CLAVE_HEARTBEAT_NEXT = Symbol.for("@mr/core-workload/heartbeat-next");

/**
 * Lo que se usa del emisor (`Heartbeat`); declarado aquí para no importar el emisor ni sus dependencias de red.
 */
export interface IEmisorNext {
    setEngine(engine: object): void;
    marcarEjecutado(): void;
    enlazarServidor(servidor: IServidorCierre): void;
    disparar(): void;
}

/**
 * Lo que se usa de lo que devuelve `iniciarHeartbeat` (`IHeartbeatCreado`).
 *
 * @property emisor - El emisor, o `null` si este proceso no emite.
 */
export interface IIniciadoNext {
    emisor: IEmisorNext|null;
}

/**
 * Lo que se le pasa a `iniciarHeartbeat` (`IConfigIniciarHeartbeat`, con el modo siempre `simple`: Next es un solo proceso).
 *
 * @property pod - Metadatos del pod.
 * @property unix - Epoch ms del arranque del proceso.
 * @property modo - Siempre `simple`.
 * @property timeoutSondaMs - Plazo de cada sondeo de la `Sonda`, si no es el de por defecto.
 */
export interface IConfigIniciarNext<TPod> {
    pod: TPod;
    unix: number;
    modo: "simple";
    timeoutSondaMs?: number;
}

/**
 * Dependencias de {@link iniciarHeartbeatNextCon}; el punto de entrada ({@link iniciarHeartbeatNext}) pasa las reales.
 *
 * @property crearPod - Lee los metadatos del pod (`crearPodInfo`).
 * @property iniciar - Decide si se emite y monta el emisor (`iniciarHeartbeat`); `null` si no aplica.
 * @property adaptador - Configuración del autosondeo y del vigilante del lock; en las pruebas, para inyectar las consultas.
 * @property proceso - El proceso, para las señales y `exit`. Por defecto `process`.
 * @property almacen - Dónde vive la guarda. Por defecto `globalThis`.
 * @property unix - Epoch ms del arranque del proceso. Por defecto `performance.timeOrigin`.
 * @property env - Variables de entorno. Por defecto `process.env`.
 * @property timeoutSondaMs - Plazo de cada autosondeo (el del adaptador y el de la `Sonda`). Por defecto, el de la `Sonda` (900 ms); en desarrollo
 *   el punto de entrada pasa 5 s, porque mientras Next compila una página el servidor tarda más en contestar y saldría un `no-listo` falso.
 */
export interface IDependenciasHeartbeatNext<TPod = unknown> {
    crearPod: () => Promise<TPod>;
    iniciar: (config: IConfigIniciarNext<TPod>) => IIniciadoNext|null;
    adaptador?: IConfigAdaptadorNext;
    proceso?: IProcesoCierre;
    almacen?: Record<symbol, unknown>;
    unix?: number;
    env?: NodeJS.ProcessEnv;
    timeoutSondaMs?: number;
}

/**
 * Lo que queda montado cuando el heartbeat de un servicio Next está habilitado.
 *
 * @property adaptador - El autosondeo y el vigilante del lock.
 * @property cierre - El cierre por señal y la salida.
 */
export interface IHeartbeatNextMontado {
    adaptador: AdaptadorNext;
    cierre: ServidorCierreNext;
}

/**
 * Monta el heartbeat de un servicio Next y devuelve lo montado, o `null` si no emite (sin `HEARTBEAT=true` —se mira antes de leer el pod—, en desarrollo sin
 * socket, o si no es un service de k8s). **Si no está habilitado no se instala nada**: ni manejador de señal, ni envoltorio de
 * `process.exit`, ni sondeo, ni borrado del lock. Rechaza si falla algo.
 */
export async function montarHeartbeatNext<TPod>({crearPod, iniciar, adaptador: configAdaptador, proceso, unix = Math.round(performance.timeOrigin), env = process.env, timeoutSondaMs}: Omit<IDependenciasHeartbeatNext<TPod>, "almacen">): Promise<IHeartbeatNextMontado|null> {
    // Primero se decide, y solo después se lee el pod: sin `HEARTBEAT=true` no se emite, y un workspace sin `mrpack.json` no tiene
    // por qué dar un aviso en cada arranque.
    if (env["HEARTBEAT"] !== "true") {
        return null;
    }
    const pod = await crearPod();
    const creado = iniciar({pod, unix, modo: "simple", timeoutSondaMs});
    const emisor = creado?.emisor ?? null;
    if (emisor === null) {
        return null;
    }

    const adaptador = new AdaptadorNext({timeoutMs: timeoutSondaMs, ...configAdaptador});
    const cierre = new ServidorCierreNext({proceso});
    emisor.setEngine(adaptador);
    emisor.marcarEjecutado();
    emisor.enlazarServidor(cierre);
    cierre.instalar();
    await adaptador.vigilarLock(() => { emisor.disparar(); });

    return {adaptador, cierre};
}

/**
 * Arranca el heartbeat de un servicio Next. **Síncrono y a prueba de fallos**: `register()` de la instrumentación bloquea el
 * primer request, así que no espera a nada; el trabajo va en segundo plano y cualquier error acaba en un `warning`. Una
 * segunda llamada en el mismo proceso no hace nada (guarda en `globalThis`).
 *
 * @returns La promesa del montaje (para las pruebas; el punto de entrada la ignora), o `null` si ya estaba arrancado.
 */
export function iniciarHeartbeatNextCon<TPod>({almacen = globalThis as unknown as Record<symbol, unknown>, ...dependencias}: IDependenciasHeartbeatNext<TPod>): Promise<IHeartbeatNextMontado|null>|null {
    if (almacen[CLAVE_HEARTBEAT_NEXT] === true) {
        return null;
    }
    almacen[CLAVE_HEARTBEAT_NEXT] = true;

    return montarHeartbeatNext(dependencias).catch((err: unknown) => {
        warning("No se pudo arrancar el heartbeat del servicio Next", err);

        return null;
    });
}
