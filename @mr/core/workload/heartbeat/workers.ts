/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 2b1c423789e6b4fce736bd4a9add9904
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IEstadoWorker, type ILecturaEstado, agregarEstados, causaMasFuerte} from "./estado";
import type {TCausaDrenado, TEstadoPod} from "./interface";

/**
 * Mensaje IPC con el que un worker informa a su primario de su estado.
 *
 * @property cmd - Siempre `"heartbeat"`; es lo que encaja en el `switch(message.cmd)` de `Main`.
 * @property estado - Estado del worker.
 * @property causaDrenado - Causa, si drena.
 */
export interface IMensajeHeartbeatWorker {
    cmd: "heartbeat";
    estado: TEstadoPod;
    causaDrenado: TCausaDrenado|null;
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
    public informe(id: number, {estado, causaDrenado}: Pick<IEstadoWorker, "estado"|"causaDrenado">, ahora: number): boolean {
        const actual = this.workers.get(id);
        if (actual === undefined) {
            return false;
        }
        this.workers.set(id, {estado, causaDrenado, ts: ahora, informado: true});
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
}
