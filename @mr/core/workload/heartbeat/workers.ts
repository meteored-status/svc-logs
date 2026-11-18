/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 12:17:13 GMT
 * Hash: c56fdfde4c377578b051b130a5f84397
 * Versión: 2026.11.16+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IEstadoWorker, type ILecturaEstado, TIMEOUT_WORKER_MS, agregarEstados, causaMasFuerte} from "./estado";
import type {IHeartbeatMetricas, TCausaDrenado, TEstadoPod} from "./interface";

/**
 * Mensaje IPC con el que un worker informa a su primario de su estado.
 *
 * @property cmd - Siempre `"heartbeat"`; es lo que encaja en el `switch(message.cmd)` de `Main`.
 * @property estado - Estado del worker.
 * @property causaDrenado - Causa, si drena.
 * @property rss - Memoria residente del worker (bytes). Opcional: un worker de una versión anterior no la manda y entonces no suma.
 */
export interface IMensajeHeartbeatWorker {
    cmd: "heartbeat";
    estado: TEstadoPod;
    causaDrenado: TCausaDrenado|null;
    rss?: number;
}

/**
 * Comprueba que un mensaje IPC es un {@link IMensajeHeartbeatWorker} bien formado.
 */
export function esMensajeHeartbeatWorker(mensaje: unknown): mensaje is IMensajeHeartbeatWorker {
    if (typeof mensaje !== "object" || mensaje === null) {
        return false;
    }
    const {cmd, estado, causaDrenado} = mensaje as Record<string, unknown>;

    return cmd === "heartbeat"
        && (estado === "arrancando" || estado === "listo" || estado === "no-listo" || estado === "drenando" || estado === "parado")
        && (causaDrenado === null || causaDrenado === "senal" || causaDrenado === "prestop");
}

/**
 * Lo último que ha dicho cada worker vivo de un pod en modo cluster. Lo usa el primario.
 */
export class RegistroWorkers {
    private readonly workers: Map<number, IEstadoWorker>;

    /**
     * Si algún worker ha informado alguna vez `drenando` o `parado`, y con qué causa. Se recuerda aunque el worker
     * muera después: sin esto, cuando salen todos el agregado volvería a `arrancando`.
     */
    private drenadoAntes: {causaDrenado: TCausaDrenado|null}|null;

    public constructor() {
        this.workers = new Map<number, IEstadoWorker>();
        this.drenadoAntes = null;
    }

    /**
     * Da de alta un worker recién creado, como `arrancando` y sin informar: no caduca hasta su primer informe.
     */
    public alta(id: number, ahora: number): void {
        this.workers.set(id, {estado: "arrancando", causaDrenado: null, ts: ahora, informado: false});
    }

    /**
     * Da de baja un worker que ha muerto: sale del total.
     */
    public baja(id: number): void {
        this.workers.delete(id);
    }

    /**
     * Anota un informe del worker. Un worker no dado de alta se ignora.
     *
     * @returns `true` si cambia su estado respecto al informe anterior.
     */
    public informe(id: number, {estado, causaDrenado, rss}: Pick<IEstadoWorker, "estado"|"causaDrenado"|"rss">, ahora: number): boolean {
        const actual = this.workers.get(id);
        if (actual === undefined) {
            return false;
        }
        const valido = typeof rss === "number" && Number.isFinite(rss) && rss >= 0;
        this.workers.set(id, {estado, causaDrenado, ts: ahora, informado: true, ...(valido ? {rss} : {})});
        if (estado === "drenando" || estado === "parado") {
            this.drenadoAntes = {causaDrenado: causaMasFuerte([this.drenadoAntes?.causaDrenado ?? null, causaDrenado])};
        }

        return actual.estado !== estado;
    }

    /**
     * Estado agregado del pod.
     */
    public agregar(ahora: number): ILecturaEstado {
        return agregarEstados([...this.workers.values()], ahora, {drenadoAntes: this.drenadoAntes});
    }

    /**
     * RSS (bytes) de los workers que cuentan: los vivos (ni `parado` ni dados de baja) que han informado hace no más de
     * `timeoutMs` —el mismo criterio con el que {@link agregar} da por caducado a un worker— y que mandaron `rss`. Un worker
     * caducado, recién dado de alta o de una versión sin `rss` no suma, y nunca con un valor viejo.
     */
    public rss(ahora: number, {timeoutMs = TIMEOUT_WORKER_MS}: {timeoutMs?: number} = {}): number {
        let total = 0;
        for (const w of this.workers.values()) {
            if (w.estado !== "parado" && w.informado !== false && ahora - w.ts <= timeoutMs && w.rss !== undefined) {
                total += w.rss;
            }
        }

        return total;
    }
}

/**
 * Métricas del heartbeat de un proceso que emite. En el primario de un cluster (`workers` no es `null`) el `rss` pasa a ser el
 * del primario más el de los workers vivos; en un pod simple se devuelven tal cual.
 */
export function metricasConWorkers(metricas: IHeartbeatMetricas, workers: RegistroWorkers|null, ahora: number): IHeartbeatMetricas {
    if (workers === null) {
        return metricas;
    }

    return {...metricas, rss: metricas.rss + workers.rss(ahora)};
}
