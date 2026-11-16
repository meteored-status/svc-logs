/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 2a527d5f57e3e009d3fae46962286650
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IHeartbeatProcesos, TCausaDrenado, TEstadoPod} from "./interface";

/** Tiempo (ms) sin informar a partir del cual un worker que ya ha informado alguna vez cuenta como no listo. */
export const TIMEOUT_WORKER_MS = 3000;

/**
 * Lo que se sabe de un proceso para decidir su estado.
 *
 * @property arrancado - El engine existe, `ejecutar()` ha resuelto y `started()` también.
 * @property listo - Resultado de la sonda de disponibilidad (el de `/admin/ready/`).
 * @property senal - Se ha recibido `SIGTERM`/`SIGINT` o el servidor está cerrando.
 * @property prestop - Ha aparecido `shutdown.lock`.
 */
export interface IEntradaEstado {
    arrancado: boolean;
    listo: boolean;
    senal: boolean;
    prestop: boolean;
}

/**
 * Estado de un proceso, que nunca es `parado` (ese lo decide la despedida).
 *
 * @property estado - Estado calculado.
 * @property causaDrenado - Solo con `drenando`.
 * @property procesos - Solo en el agregado de un pod en modo cluster.
 */
export interface ILecturaEstado {
    estado: Exclude<TEstadoPod, "parado">;
    causaDrenado: TCausaDrenado|null;
    procesos?: IHeartbeatProcesos;
}

/**
 * Último informe de un worker.
 *
 * @property estado - Estado informado.
 * @property causaDrenado - Causa informada, si drenaba.
 * @property ts - Epoch ms en que el primario recibió el informe (o dio de alta el worker, si aún no ha informado).
 * @property informado - `false` mientras el worker solo está dado de alta y no ha mandado su primer informe. Ese worker no
 *   caduca con `timeoutMs`: hasta que carga el código e inicia el heartbeat no puede informar, y eso puede llevar decenas de
 *   segundos (17 s medidos en status-backend). Si no arranca nunca, lo mata la `startupProbe`. Sin el campo, cuenta como informado.
 */
export interface IEstadoWorker {
    estado: TEstadoPod;
    causaDrenado: TCausaDrenado|null;
    ts: number;
    informado?: boolean;
}

/**
 * Configuración de {@link agregarEstados}.
 *
 * @property timeoutMs - Silencio máximo de un worker antes de contarlo como no listo. Por defecto {@link TIMEOUT_WORKER_MS}.
 * @property drenadoAntes - Si el pod ya ha drenado (algún worker informó `drenando` o `parado`), con qué causa. Sin workers vivos,
 *   el agregado sigue en `drenando` en vez de volver a `arrancando`: un pod que se apaga no arranca de nuevo.
 */
export interface IConfigAgregar {
    timeoutMs?: number;
    drenadoAntes?: {causaDrenado: TCausaDrenado|null}|null;
}

/**
 * La causa de drenado que manda: `senal` gana a `prestop`.
 */
export function causaMasFuerte(causas: (TCausaDrenado|null)[]): TCausaDrenado|null {
    if (causas.includes("senal")) {
        return "senal";
    }

    return causas.includes("prestop") ? "prestop" : null;
}

/**
 * Estado de un proceso. `drenando` gana a todo, y dentro de él `senal` gana a `prestop`; sin drenado,
 * `arrancando` hasta que el engine ha arrancado y después `listo`/`no-listo` según la sonda.
 */
export function calcularEstado({arrancado, listo, senal, prestop}: IEntradaEstado): ILecturaEstado {
    if (senal || prestop) {
        return {estado: "drenando", causaDrenado: senal ? "senal" : "prestop"};
    }
    if (!arrancado) {
        return {estado: "arrancando", causaDrenado: null};
    }

    return {estado: listo ? "listo" : "no-listo", causaDrenado: null};
}

/**
 * Agrega el estado de los workers vivos de un pod en modo cluster.
 *
 * - Un worker `parado` no cuenta (ya no está). Los que mueren los quita quien llama.
 * - Un worker que lleva más de `timeoutMs` sin informar cuenta como `no-listo`, diga lo que diga su último informe; salvo
 *   si todavía no ha informado nunca (`informado: false`), que sigue `arrancando`: si no, el pod pasaba de `no-listo` a
 *   `arrancando` cuando el worker por fin informaba.
 * - `drenando` si alguno drena; `listo` si todos están listos; `arrancando` si ninguno está listo y alguno
 *   arranca; `no-listo` en el resto. Sin workers, `arrancando`, **salvo que ya haya drenado** (`drenadoAntes`):
 *   entonces sigue `drenando`, porque lo que queda sin workers es un pod que se está apagando.
 *
 * @param workers - Último informe de cada worker vivo.
 * @param ahora - Epoch ms de referencia.
 */
export function agregarEstados(workers: IEstadoWorker[], ahora: number, {timeoutMs = TIMEOUT_WORKER_MS, drenadoAntes = null}: IConfigAgregar = {}): ILecturaEstado & {procesos: IHeartbeatProcesos} {
    const vivos = workers
        .filter((w) => w.estado !== "parado")
        .map((w) => w.informado !== false && ahora - w.ts > timeoutMs ? {estado: "no-listo" as TEstadoPod, causaDrenado: null} : w);
    const listos = vivos.filter((w) => w.estado === "listo").length;
    const procesos = {total: vivos.length, listos};

    const drenando = vivos.filter((w) => w.estado === "drenando");
    if (drenando.length > 0) {
        return {estado: "drenando", causaDrenado: causaMasFuerte(drenando.map((w) => w.causaDrenado)), procesos};
    }
    if (vivos.length === 0) {
        if (drenadoAntes !== null) {
            return {estado: "drenando", causaDrenado: drenadoAntes.causaDrenado, procesos};
        }

        return {estado: "arrancando", causaDrenado: null, procesos};
    }
    if (listos === vivos.length) {
        return {estado: "listo", causaDrenado: null, procesos};
    }
    if (listos === 0 && vivos.some((w) => w.estado === "arrancando")) {
        return {estado: "arrancando", causaDrenado: null, procesos};
    }

    return {estado: "no-listo", causaDrenado: null, procesos};
}
