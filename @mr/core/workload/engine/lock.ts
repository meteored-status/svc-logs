/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 4c924932fffb9e2db9e2dc1ba1d8d524
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {rm, stat} from "node:fs/promises";
import path from "node:path";

import {PRESUPUESTO_ANTES_DE_CERRAR_MS} from "@mr/core-network/server/http/config/net";

/** Directorio donde el hook preStop del kustomize escribe `shutdown.lock`. */
export const DIR_ADMIN = "files/tmp/admin/";

/** Nombre del fichero con el que el hook preStop pide el apagado del pod. */
export const NOMBRE_LOCK_APAGADO = "shutdown.lock";

/**
 * Margen (ms), contado desde que el preStop escribe `shutdown.lock`, que se deja a que el pod salga de los endpoints del
 * balanceador antes de que el servidor deje de escuchar. Cabe en el presupuesto de `antesDeCerrar` del servidor HTTP.
 */
export const MARGEN_ENDPOINTS_MS = 3_000;

/**
 * Cuánto falta del margen de endpoints. Es el margen completo si no se sabe cuándo se escribió el lock (`mtimeMs`
 * `null`) o si su fecha está en el futuro (reloj distinto); si no, `margenMs` menos lo que ya ha pasado, acotado a
 * `[0, margenMs]`.
 *
 * @param config.ahoraMs - Instante actual en ms.
 * @param config.mtimeMs - Instante de modificación del lock en ms, o `null` si no existe.
 * @param config.margenMs - Margen total en ms.
 */
export function calcularMargenPendiente({ahoraMs, mtimeMs, margenMs}: {ahoraMs: number; mtimeMs: number|null; margenMs: number}): number {
    if (mtimeMs === null || mtimeMs > ahoraMs) {
        return margenMs;
    }

    return Math.min(margenMs, Math.max(0, margenMs - (ahoraMs - mtimeMs)));
}

/** Holgura (ms) que se deja bajo el presupuesto de `antesDeCerrar` para que éste no venza antes que la espera del margen. */
export const HOLGURA_PRESUPUESTO_MS = 250;

/**
 * Cuánto esperar de verdad (ms) en el callback de `antesDeCerrar`: el margen pendiente, descontando lo que ya ha tardado el
 * propio callback en calcularlo (el `stat`) y sin pasar de `PRESUPUESTO_ANTES_DE_CERRAR_MS` menos {@link HOLGURA_PRESUPUESTO_MS}.
 * Sin esto, sin lock en producción (margen completo) el presupuesto vencía siempre antes y salía un aviso espurio.
 *
 * @param config.margenMs - Margen pendiente, de {@link margenPendienteMs}.
 * @param config.transcurridoMs - Lo que lleva el callback desde que empezó.
 */
export function esperaMargenMs({margenMs, transcurridoMs}: {margenMs: number; transcurridoMs: number}): number {
    return Math.max(0, Math.min(margenMs, PRESUPUESTO_ANTES_DE_CERRAR_MS - HOLGURA_PRESUPUESTO_MS) - transcurridoMs);
}

/**
 * Configuración de {@link margenPendienteMs}.
 *
 * @property dir - Directorio donde se escribe el lock. Por defecto {@link DIR_ADMIN}.
 * @property produccion - Si corre en producción; fuera de ella no hay margen. Por defecto `PRODUCCION`.
 * @property ahora - Reloj, inyectable para las pruebas. Por defecto `Date.now`.
 */
export interface IConfigMargen {
    dir?: string;
    produccion?: boolean;
    ahora?: () => number;
}

/**
 * Lo que falta (ms) del margen de {@link MARGEN_ENDPOINTS_MS}, medido desde la fecha de `shutdown.lock`: con un
 * `sleep 3` en el preStop ya ha pasado (~0), sin él quedan ~3 s, y sin lock en producción (la señal llegó por otra vía)
 * el margen completo. Fuera de producción es siempre 0. Nunca rechaza.
 */
export async function margenPendienteMs({dir = DIR_ADMIN, produccion = global.PRODUCCION, ahora = Date.now}: IConfigMargen = {}): Promise<number> {
    if (!produccion) {
        return 0;
    }
    let mtimeMs: number|null = null;
    try {
        mtimeMs = (await stat(path.join(dir, NOMBRE_LOCK_APAGADO))).mtimeMs;
    } catch {
        mtimeMs = null;
    }

    return calcularMargenPendiente({ahoraMs: ahora(), mtimeMs, margenMs: MARGEN_ENDPOINTS_MS});
}

/**
 * Borra un `shutdown.lock` que haya sobrevivido a un reinicio del contenedor.
 *
 * El preStop lo escribe en un `emptyDir`, que pertenece al pod y no al contenedor: si la liveness reinicia el
 * contenedor, el nuevo lo encuentra al arrancar y, al vigilar la carpeta, abortaría como si le hubieran pedido
 * el apagado. Se borra **antes** de empezar a vigilar. Nunca rechaza: si no se puede borrar se sigue.
 *
 * @param dir - Directorio donde se escribe el lock. Por defecto {@link DIR_ADMIN}.
 * @returns `true` si se ha ejecutado el borrado sin error (exista el fichero o no).
 */
export async function borrarLockApagado(dir: string = DIR_ADMIN): Promise<boolean> {
    try {
        await rm(path.join(dir, NOMBRE_LOCK_APAGADO), {force: true});

        return true;
    } catch {
        return false;
    }
}
