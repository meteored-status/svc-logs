/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 16:37:03 GMT
 * Hash: 7b1710a10fe5c9bbd7e9d7b33569f756
 * Versión: 2026.11.16+5-bixus
 * Anterior: 2026.11.16+4-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {stat} from "node:fs/promises";
import http from "node:http";
import path from "node:path";

import {Deferred} from "services-comun/modules/utiles/promise";

import {DIR_ADMIN, NOMBRE_LOCK_APAGADO, borrarLockApagado} from "../../engine/lock";
import type {IEngineSonda} from "../sonda";

/**
 * Hace un `GET` y devuelve el código HTTP de la respuesta. Rechaza si no hay conexión o vence el tiempo.
 */
export type TConsultaHttp = (url: string, timeoutMs: number) => Promise<number>;

/**
 * Configuración de {@link AdaptadorNext}.
 *
 * @property puerto - Puerto en el que escucha Next. Por defecto `process.env.PORT` (Next lo deja puesto antes de cargar la instrumentación) y, si no, 3000.
 * @property dir - Directorio donde el preStop escribe `shutdown.lock`. Por defecto {@link DIR_ADMIN}.
 * @property consultar - Hace la consulta HTTP del autosondeo. Por defecto {@link consultarHttp}.
 * @property existeLock - Dice si `shutdown.lock` existe. Por defecto, un `stat` en `dir`.
 * @property timeoutMs - Tiempo máximo de una consulta. Por defecto 900, igual que el de la sonda.
 * @property intervaloLockMs - Cada cuánto se mira si ha aparecido `shutdown.lock`. Por defecto 500.
 * @property intervaloSondeoMs - Cada cuánto se hace de verdad el autosondeo de `/admin/ready`; entre sondeos `ready()` devuelve el último resultado. Por defecto {@link INTERVALO_AUTOSONDEO_MS}.
 * @property plazoNoListoMs - Tiempo seguido sin un sondeo bueno a partir del cual `ready()` rechaza. Por defecto {@link PLAZO_NO_LISTO_MS}.
 * @property ahora - Reloj en milisegundos. Por defecto `Date.now`.
 */
export interface IConfigAdaptadorNext {
    puerto?: number|string;
    dir?: string;
    consultar?: TConsultaHttp;
    existeLock?: () => Promise<boolean>;
    timeoutMs?: number;
    intervaloLockMs?: number;
    intervaloSondeoMs?: number;
    plazoNoListoMs?: number;
    ahora?: () => number;
}

/**
 * Cada cuánto se hace de verdad el autosondeo de `/admin/ready`. Atender el sondeo es más de la mitad de la CPU de reposo del
 * heartbeat en un Next, así que es más lento que el del kubelet (1 s): `ready()` lo llama la `Sonda` cada segundo y devuelve el
 * último resultado entre sondeos.
 */
export const INTERVALO_AUTOSONDEO_MS = 5000;

/**
 * Tiempo seguido sin que `/admin/ready` conteste bien que hace falta para `no-listo`. Es el equivalente en tiempo de la
 * `readinessProbe` del kustomize (`_componentes/deployment/deployment.yaml`: `failureThreshold: 10` × `periodSeconds: 1`): el kubelet
 * no saca el pod de los endpoints por un fallo suelto, y `/infra/pods` tampoco debe avisar. Con el sondeo cada
 * {@link INTERVALO_AUTOSONDEO_MS} son 2 fallos seguidos. Si se cambia allí, se cambia aquí.
 */
export const PLAZO_NO_LISTO_MS = 10_000;

/**
 * Margen que se le resta al plazo de la consulta de `ready()` para que venza antes que el `PromiseTimeout` de la `Sonda` (que
 * arranca antes y tiene el mismo plazo): si venciera ella primero, contaría un fallo sin pasar por la cuenta del adaptador.
 */
export const MARGEN_SONDA_MS = 50;

/**
 * Máximo de redirecciones que sigue {@link consultarHttp}, como el kubelet.
 */
export const MAX_REDIRECCIONES = 10;

interface IRespuestaHttp {
    codigo: number;
    location: string|undefined;
}

async function pedir(url: URL, timeoutMs: number): Promise<IRespuestaHttp> {
    const deferred = new Deferred<IRespuestaHttp>();
    const peticion = http.request(url, {method: "GET", agent: false, headers: {Connection: "close"}, timeout: timeoutMs}, (respuesta) => {
        respuesta.resume();
        deferred.resolve({codigo: respuesta.statusCode ?? 0, location: respuesta.headers.location});
    });
    peticion.on("timeout", () => { peticion.destroy(new Error(`sin respuesta en ${timeoutMs} ms`)); });
    peticion.on("error", (err) => { deferred.reject(err); });
    peticion.end();

    return deferred.promise;
}

/**
 * Consulta por defecto del autosondeo: una petición `GET` a la misma máquina que **no deja conexiones vivas** (sin agente
 * y con `Connection: close`: una keep-alive haría esperar al `server.close()` de Next al apagar).
 *
 * **Sigue las redirecciones como el kubelet**: si el proyecto tiene `trailingSlash: true`, Next contesta `308` a `/admin/ready` (sin barra) antes de que llegue a
 * `proxy.ts` y el kubelet lo sigue: una `Location` relativa, o absoluta `http` con el mismo host y puerto, hasta
 * {@link MAX_REDIRECCIONES} saltos (más, rechaza, igual que el kubelet), cada uno con su conexión. **Una redirección a otro host (u
 * otro protocolo) no se sigue y devuelve el código 3xx** —el kubelet la da por buena y solo avisa con un evento—, o sea, `listo`.
 * `timeoutMs` es el tope **total** de todos los saltos. Rechaza si no hay conexión o vence el tiempo.
 */
export async function consultarHttp(url: string, timeoutMs: number): Promise<number> {
    const limite = Date.now() + timeoutMs;
    let actual = new URL(url);
    for (let salto = 0; ; salto++) {
        const restante = limite - Date.now();
        if (restante <= 0) {
            throw new Error(`sin respuesta en ${timeoutMs} ms`);
        }
        let respuesta: IRespuestaHttp;
        try {
            respuesta = await pedir(actual, restante);
        } catch (err) {
            // Que el mensaje diga el tope total, no lo que quedaba en este salto.
            throw err instanceof Error && err.message.startsWith("sin respuesta en") ? new Error(`sin respuesta en ${timeoutMs} ms`) : err;
        }
        const {codigo, location} = respuesta;
        if (codigo < 300 || codigo >= 400 || location === undefined) {
            return codigo;
        }
        let siguiente: URL;
        try {
            siguiente = new URL(location, actual);
        } catch {
            return codigo;
        }
        if (siguiente.protocol !== "http:" || siguiente.hostname !== actual.hostname || siguiente.port !== actual.port) {
            return codigo;
        }
        if (salto >= MAX_REDIRECCIONES) {
            throw new Error(`más de ${MAX_REDIRECCIONES} redirecciones`);
        }
        actual = siguiente;
    }
}

/**
 * Lo mismo que el kubelet: una respuesta 200–399 es buena; cualquier otra (4xx, 5xx, 0) no.
 */
export function respuestaBuena(codigo: number): boolean {
    return codigo >= 200 && codigo < 400;
}

/**
 * Lo que a un servicio Next le falta de un `Engine`, para que la `Sonda` lo use por duck typing:
 *
 * - `started()` y `ready()` son un **autosondeo** de `/admin/started` y `/admin/ready` **sin barra final** en la propia máquina (con `trailingSlash: false`, que es lo
 *   habitual, una barra costaría un `308` más: el doble de peticiones por el enrutado y `proxy.ts` cada segundo; con `trailingSlash: true` el `308` se sigue). Mide lo mismo que el kubelet, que usa `/admin/ready/`, y es lo que
 *   hace el kubelet: así `/infra/pods` dice lo mismo que los endpoints de k8s, y un Next que ha dejado de contestar sale
 *   `no-listo` (o en silencio). Rechazan si no contesta 200–399, no hay conexión o vence el tiempo.
 * - `preStopSolicitado` pasa a `true` cuando aparece `shutdown.lock` (lo escribe el preStop del kustomize). Next no tiene
 *   el watcher del Engine HTTP, así que {@link vigilarLock} hace un `stat` cada medio segundo.
 *
 * `ready()` **tolera fallos como el kubelet**: solo rechaza si lleva {@link PLAZO_NO_LISTO_MS} sin un sondeo bueno (un éxito reinicia
 * la cuenta) y **no sondea en cada llamada**: la `Sonda` lo llama cada segundo, pero solo se consulta de verdad cada
 * {@link INTERVALO_AUTOSONDEO_MS}; entre sondeos devuelve el último resultado (un éxito viejo puede tapar un fallo hasta ese intervalo).
 * Las llamadas simultáneas comparten el sondeo en vuelo. La `Sonda` no aplica histéresis propia (un fallo de `ready()` es `no-listo` al momento), así que la
 * cuenta no se duplica. `started()` no cuenta: el primer sondeo bueno marca `listo` el arranque.
 *
 * No tiene `ultimoReady`: la sonda llama a `ready()` en cada evaluación. Tras el lock o la señal la `Sonda` mira antes
 * `drenado()`, así que ya no se hacen más autosondeos.
 */
export class AdaptadorNext implements IEngineSonda {
    private readonly puerto: string;
    private readonly dir: string;
    private readonly consultar: TConsultaHttp;
    private readonly existeLock: () => Promise<boolean>;
    private readonly timeoutMs: number;
    private readonly intervaloLockMs: number;
    private readonly intervaloSondeoMs: number;
    private readonly plazoNoListoMs: number;
    private readonly ahora: () => number;
    private ultimoBueno: number|null;
    private ultimoSondeo: number|null;
    private errorVigente: Error|null;
    private enVuelo: Promise<void>|null;
    private timerLock: NodeJS.Timeout|null;
    private lockVisto: boolean;

    public get preStopSolicitado(): boolean {
        return this.lockVisto;
    }

    public constructor({puerto, dir = DIR_ADMIN, consultar = consultarHttp, existeLock, timeoutMs = 900, intervaloLockMs = 500, intervaloSondeoMs = INTERVALO_AUTOSONDEO_MS, plazoNoListoMs = PLAZO_NO_LISTO_MS, ahora = Date.now}: IConfigAdaptadorNext = {}) {
        this.puerto = String(puerto ?? process.env["PORT"] ?? 3000);
        this.dir = dir;
        this.consultar = consultar;
        this.existeLock = existeLock ?? (async () => this.lockEnDisco());
        this.timeoutMs = timeoutMs;
        this.intervaloLockMs = intervaloLockMs;
        this.intervaloSondeoMs = intervaloSondeoMs;
        this.plazoNoListoMs = plazoNoListoMs;
        this.ahora = ahora;
        this.ultimoBueno = null;
        this.ultimoSondeo = null;
        this.errorVigente = null;
        this.enVuelo = null;
        this.timerLock = null;
        this.lockVisto = false;
    }

    public async started(): Promise<void> {
        await this.sondear("/admin/started");
    }

    public async ready(): Promise<void> {
        const ahora = this.ahora();
        this.ultimoBueno ??= ahora;
        if (this.enVuelo === null && (this.ultimoSondeo === null || ahora - this.ultimoSondeo >= this.intervaloSondeoMs)) {
            this.ultimoSondeo = ahora;
            this.enVuelo = this.sondearReady().finally(() => { this.enVuelo = null; });
        }
        if (this.enVuelo !== null) {
            await this.enVuelo;
        }
        if (this.errorVigente !== null) {
            throw this.errorVigente;
        }
    }

    /**
     * Borra un `shutdown.lock` que haya sobrevivido a un reinicio del contenedor (el preStop lo escribe en un `emptyDir`, que
     * es del pod y no del contenedor) y **después** empieza a vigilarlo. Cuando aparece marca `preStopSolicitado`, llama a
     * `disparar` y deja de mirar. El temporizador lleva `unref`. Nunca rechaza.
     *
     * @param disparar - Fuerza una evaluación y un envío del heartbeat.
     */
    public async vigilarLock(disparar: () => void): Promise<void> {
        await borrarLockApagado(this.dir);
        if (this.timerLock !== null || this.lockVisto) {
            return;
        }
        let mirando = false;
        this.timerLock = setInterval(() => {
            if (mirando) {
                return;
            }
            mirando = true;
            void this.mirarLock(disparar).finally(() => { mirando = false; });
        }, this.intervaloLockMs);
        this.timerLock.unref();
    }

    /**
     * Deja de vigilar el lock.
     */
    public detener(): void {
        if (this.timerLock !== null) {
            clearInterval(this.timerLock);
            this.timerLock = null;
        }
    }

    private async mirarLock(disparar: () => void): Promise<void> {
        let existe = false;
        try {
            existe = await this.existeLock();
        } catch {
            existe = false;
        }
        if (!existe || this.lockVisto) {
            return;
        }
        this.lockVisto = true;
        this.detener();
        disparar();
    }

    private async lockEnDisco(): Promise<boolean> {
        try {
            await stat(path.join(this.dir, NOMBRE_LOCK_APAGADO));

            return true;
        } catch {
            return false;
        }
    }

    private async sondearReady(): Promise<void> {
        try {
            await this.sondear("/admin/ready", Math.max(1, this.timeoutMs - MARGEN_SONDA_MS));
            this.ultimoBueno = this.ahora();
            this.errorVigente = null;
        } catch (err) {
            if (this.ahora() - (this.ultimoBueno ?? 0) >= this.plazoNoListoMs) {
                this.errorVigente = err instanceof Error ? err : new Error(String(err));
            }
        }
    }

    private async sondear(ruta: string, timeoutMs: number = this.timeoutMs): Promise<void> {
        const codigo = await this.consultar(`http://127.0.0.1:${this.puerto}${ruta}`, timeoutMs);
        if (!respuestaBuena(codigo)) {
            throw new Error(`${ruta} respondió ${codigo}`);
        }
    }
}
