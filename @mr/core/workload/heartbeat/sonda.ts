/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: a0b621128197e6c8b9d692b99e91ba6e
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {PromiseTimeout} from "services-comun/modules/utiles/promise";

import {type ILecturaEstado, calcularEstado} from "./estado";

/**
 * Lo que la sonda mira del engine. Todo es opcional porque el engine base no tiene HTTP; se detecta por
 * duck typing en {@link Sonda.setEngine}.
 *
 * @property started - Sonda de arranque (`/admin/started/`).
 * @property ready - Sonda de disponibilidad (`/admin/ready/`).
 * @property ultimoReady - Último resultado de `/admin/ready/` con su hora, si ya lo hubo.
 * @property preStopSolicitado - `true` desde que apareció `shutdown.lock`.
 */
export interface IEngineSonda {
    started?(): Promise<void>;
    ready?(): Promise<void>;
    readonly ultimoReady?: {ok: boolean; ts: number}|null;
    readonly preStopSolicitado?: boolean;
}

/**
 * Configuración de {@link Sonda}.
 *
 * @property ahora - Reloj en ms. Por defecto `Date.now`.
 * @property timeoutMs - Tiempo máximo de una llamada a `started()`/`ready()`. Por defecto 900.
 * @property frescoMs - Antigüedad máxima del último resultado de `/admin/ready/` para reutilizarlo en vez
 *   de llamar a `ready()`. Por defecto 2000.
 * @property finita - Carga finita (cronjob o job): está `listo` («en curso») en cuanto tiene engine, sin esperar a `ejecutar()` ni
 *   llamar a `started()`/`ready()`, que un cronjob no tiene por qué atender. Por defecto `false`.
 */
export interface IConfigSonda {
    ahora?: () => number;
    timeoutMs?: number;
    frescoMs?: number;
    finita?: boolean;
}

/**
 * Calcula el estado de **este proceso**: arrancado y listo salen del engine, drenando de la señal y del
 * preStop. Lo comparten el emisor de un pod simple y el informante de un worker.
 *
 * Para no doblar el coste de `engine.ready()` —que en algunos servicios consulta Elastic—, si
 * `/admin/ready/` se ha contestado hace menos de `frescoMs` se usa ese resultado, y si no se llama a
 * `ready()` con un timeout.
 */
export class Sonda {
    private readonly ahora: () => number;
    private readonly timeoutMs: number;
    private readonly frescoMs: number;
    private readonly finita: boolean;
    private engine: IEngineSonda|null;
    private ejecutado: boolean;
    private startedOk: boolean;
    private senalRecibida: boolean;
    private consultaCierre: () => boolean;

    public constructor({ahora = Date.now, timeoutMs = 900, frescoMs = 2000, finita = false}: IConfigSonda = {}) {
        this.ahora = ahora;
        this.timeoutMs = timeoutMs;
        this.frescoMs = frescoMs;
        this.finita = finita;
        this.engine = null;
        this.ejecutado = false;
        this.startedOk = false;
        this.senalRecibida = false;
        this.consultaCierre = () => false;
    }

    public setEngine(engine: object): void {
        this.engine = engine as IEngineSonda;
    }

    /**
     * `engine.ejecutar()` ha resuelto. Para un engine sin HTTP es lo que lo hace `listo`.
     */
    public marcarEjecutado(): void {
        this.ejecutado = true;
    }

    /**
     * Se ha empezado a cerrar por señal.
     */
    public marcarSenal(): void {
        this.senalRecibida = true;
    }

    /**
     * Cómo preguntar si el servidor ya está cerrando (`Server.isShuttingDown`).
     */
    public setConsultaCierre(consulta: () => boolean): void {
        this.consultaCierre = consulta;
    }

    /**
     * Estado de este proceso en este instante.
     */
    public async evaluar(): Promise<ILecturaEstado> {
        const drenado = this.drenado();
        if (drenado !== null) {
            return drenado;
        }

        const arrancado = await this.comprobarArrancado();
        const listo = arrancado && await this.comprobarListo();

        // Lo que tarde la sonda puede haber coincidido con la señal.
        return this.drenado() ?? calcularEstado({arrancado, listo, senal: false, prestop: false});
    }

    private drenado(): ILecturaEstado|null {
        const senal = this.senalRecibida || this.consultaCierre();
        const prestop = this.engine?.preStopSolicitado === true;

        return senal || prestop ? calcularEstado({arrancado: true, listo: false, senal, prestop}) : null;
    }

    private async comprobarArrancado(): Promise<boolean> {
        const engine = this.engine;
        if (this.finita) {
            return engine !== null;
        }
        if (engine === null || !this.ejecutado) {
            return false;
        }
        if (this.startedOk || typeof engine.started !== "function") {
            return true;
        }
        try {
            await PromiseTimeout(engine.started(), this.timeoutMs);
            this.startedOk = true;
        } catch {
            return false;
        }

        return true;
    }

    private async comprobarListo(): Promise<boolean> {
        const engine = this.engine;
        if (this.finita || engine === null || typeof engine.ready !== "function") {
            return true;
        }
        const ultimo = engine.ultimoReady;
        if (ultimo !== undefined && ultimo !== null && this.ahora() - ultimo.ts < this.frescoMs) {
            return ultimo.ok;
        }
        try {
            await PromiseTimeout(engine.ready(), this.timeoutMs);

            return true;
        } catch {
            return false;
        }
    }
}
