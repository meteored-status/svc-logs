/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 13:26:05 GMT
 * Hash: 46658f29d761b0e5ad0559149f65a434
 * Versión: 2026.11.16+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import os from "node:os";

import {info, warning} from "services-comun/modules/utiles/log";

import {DESPEDIDA_MAX_MS, despedirAcotado} from "../cierre-primario";
import type {IServidorCierre} from "../registro";

/**
 * Señales de cierre que atiende {@link ServidorCierreNext}.
 */
export type TSenalCierre = "SIGTERM"|"SIGINT";

/**
 * Lo que {@link ServidorCierreNext} usa de `process` (se inyecta un falso en las pruebas).
 *
 * @property on - Registra un manejador de la señal.
 * @property off - Lo quita.
 * @property listenerCount - Cuántos manejadores tiene la señal.
 * @property exit - Termina el proceso. Es la que se envuelve tras la señal.
 */
export interface IProcesoCierre {
    on(senal: TSenalCierre, cb: () => void): unknown;
    off(senal: TSenalCierre, cb: () => void): unknown;
    listenerCount(senal: TSenalCierre): number;
    exit: (codigo?: number|string|null) => never;
}

/**
 * Configuración de {@link ServidorCierreNext}.
 *
 * @property proceso - El proceso. Por defecto `process`.
 * @property despedidaMs - Tope de la despedida (`parado`, vaciar y destruir el pool) antes del `exit` real. Por defecto {@link DESPEDIDA_MAX_MS}.
 */
export interface IConfigServidorCierre {
    proceso?: IProcesoCierre;
    despedidaMs?: number;
}

/**
 * El «servidor» de un servicio Next para el heartbeat ({@link IServidorCierre}): Next no expone su servidor ni ganchos de
 * cierre, así que esto se apoya en lo que sí hay, `process`.
 *
 * - **Señal.** `SIGTERM`/`SIGINT` se atienden con un manejador propio que queda **después** del de Next (que se instala al
 *   escuchar, antes de cargar la instrumentación) y, por tanto, corre en el mismo tick que su `server.close()`. Marca el cierre
 *   (`isShuttingDown`), avisa a `alIniciarCierre` (el heartbeat pasa a `drenando`) y envuelve `process.exit`. Si nadie más atiende
 *   la señal (p. ej. con `NEXT_MANUAL_SIG_HANDLE`), este manejador anularía la acción por defecto de Node, así que sale él con
 *   `128 + n`, como habría hecho Node.
 * - **Salida.** Next termina con `process.exit(143)` (o `0` en la 15.5) cuando acaba su cierre. El envoltorio, en la primera
 *   llamada, ejecuta los `antesDeSalir` registrados —la despedida— con un tope de `despedidaMs` y **después** hace el `exit`
 *   real con **el mismo código**. Las llamadas a `exit` mientras la despedida está pendiente se ignoran. Un temporizador con
 *   referencia mantiene vivo el proceso durante la espera: sin él, con el bucle de eventos vacío, Node saldría solo con 0 en vez
 *   de con el código de Next.
 *
 * Solo se envuelve tras la señal. Si Next no termina dentro de la gracia, llega `SIGKILL` y el receptor lo cuenta como silencio
 * esperado tras drenar.
 */
export class ServidorCierreNext implements IServidorCierre {
    private readonly proceso: IProcesoCierre;
    private readonly despedidaMs: number;
    private readonly alIniciar: (() => void)[];
    private readonly alSalir: (() => Promise<void>)[];
    private readonly manejadores: Map<TSenalCierre, () => void>;
    private salirReal: IProcesoCierre["exit"]|null;
    private envoltorio: IProcesoCierre["exit"]|null;
    private cerrando: boolean;
    private saliendo: boolean;

    public constructor({proceso = process as unknown as IProcesoCierre, despedidaMs = DESPEDIDA_MAX_MS}: IConfigServidorCierre = {}) {
        this.proceso = proceso;
        this.despedidaMs = despedidaMs;
        this.alIniciar = [];
        this.alSalir = [];
        this.manejadores = new Map();
        this.salirReal = null;
        this.envoltorio = null;
        this.cerrando = false;
        this.saliendo = false;
    }

    public isShuttingDown(): boolean {
        return this.cerrando;
    }

    public alIniciarCierre(cb: () => void): void {
        this.alIniciar.push(cb);
    }

    public antesDeSalir(cb: () => Promise<void>): void {
        this.alSalir.push(cb);
    }

    /**
     * Registra los manejadores de `SIGTERM` y `SIGINT`. Idempotente.
     */
    public instalar(): void {
        for (const senal of ["SIGTERM", "SIGINT"] as const) {
            if (this.manejadores.has(senal)) {
                continue;
            }
            const manejador = (): void => { this.alRecibir(senal); };
            this.manejadores.set(senal, manejador);
            this.proceso.on(senal, manejador);
        }
    }

    /**
     * Quita los manejadores y, si se había envuelto, devuelve `process.exit` a su sitio (para las pruebas).
     */
    public desinstalar(): void {
        for (const [senal, manejador] of this.manejadores) {
            this.proceso.off(senal, manejador);
        }
        this.manejadores.clear();
        if (this.salirReal !== null && this.proceso.exit === this.envoltorio) {
            this.proceso.exit = this.salirReal;
        }
    }

    private alRecibir(senal: TSenalCierre): void {
        if (this.cerrando) {
            return;
        }
        this.cerrando = true;
        info(`Recibida señal ${senal}; el heartbeat pasa a drenando`);
        for (const cb of this.alIniciar) {
            try {
                cb();
            } catch (err) {
                warning("Error marcando el cierre del heartbeat", err);
            }
        }
        this.envolverSalida();
        if (this.proceso.listenerCount(senal) <= 1) {
            // Solo estamos nosotros: Next no la atiende y la acción por defecto de Node, que terminaba el proceso, ya no corre.
            this.salirConDespedida(128 + (os.constants.signals[senal] ?? 0));
        }
    }

    private envolverSalida(): void {
        if (this.salirReal !== null) {
            return;
        }
        const real = this.proceso.exit;
        const envoltorio = ((codigo?: number|string|null): void => { this.salirConDespedida(codigo); }) as IProcesoCierre["exit"];
        this.salirReal = real;
        this.envoltorio = envoltorio;
        this.proceso.exit = envoltorio;
    }

    private salirConDespedida(codigo?: number|string|null): void {
        if (this.saliendo) {
            return;
        }
        this.saliendo = true;
        void this.despedirYSalir(codigo);
    }

    private async despedirYSalir(codigo?: number|string|null): Promise<void> {
        const real = this.salirReal ?? this.proceso.exit;
        // Con referencia a propósito (ver la descripción de la clase): `despedirAcotado` usa uno con `unref`.
        const mantener = setTimeout(() => undefined, this.despedidaMs + 500);
        try {
            await despedirAcotado({
                alIniciarCierre: () => undefined,
                despedir: async () => {
                    for (const cb of this.alSalir) {
                        await cb();
                    }
                },
            }, this.despedidaMs);
        } finally {
            clearTimeout(mantener);
        }
        real.call(this.proceso, codigo);
    }
}
