/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 36ffa6391cdfd51df972c6cbb1419066
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

/**
 * Limitador de logs: deja pasar como mucho un log por tipo y por intervalo, y cuenta los que calla. Pensado para fallos que llegan a ráfagas (p. ej.
 * un error por cada intento de reconexión o por cada operación con Redis caído) y no deben inundar el log. Es puro: recibe la hora, no lee el reloj.
 */

/**
 * Tipo de un error para agrupar logs: su código (`ECONNREFUSED`...) si lo tiene y, si no, el nombre de su clase. Acotado, así que sirve de clave de
 * `LogThrottle`.
 *
 * @param err Error capturado (o cualquier valor lanzado).
 */
export function errorType(err: unknown): string {
    if (err instanceof Error) {
        const code = (err as NodeJS.ErrnoException).code;
        return typeof code === "string" ? code : err.constructor.name;
    }
    return typeof err;
}

/**
 * Deja pasar como mucho un log por tipo y por intervalo.
 */
export class LogThrottle {
    /* STATIC */

    /**
     * Intervalo mínimo por defecto entre dos logs del mismo tipo, en milisegundos.
     */
    public static readonly INTERVAL_MS = 60_000;

    /* INSTANCE */

    private readonly intervalMs: number;
    private readonly last: Map<string, number>;
    private readonly suppressed: Map<string, number>;

    /**
     * @param intervalMs Intervalo mínimo entre dos logs del mismo tipo, en milisegundos. Por defecto `LogThrottle.INTERVAL_MS`.
     */
    public constructor(intervalMs: number = LogThrottle.INTERVAL_MS) {
        this.intervalMs = intervalMs;
        this.last = new Map();
        this.suppressed = new Map();
    }

    /**
     * Consulta si hay que escribir el log de un tipo en este instante.
     *
     * @param type Tipo del log (acotado: p. ej. `errorType(err)` y, si hace falta, el rol del nodo; la clave crece con cada tipo distinto).
     * @param nowMs Instante actual, en milisegundos.
     * @returns `null` si hay que callar; si no, cuántos logs del mismo tipo se callaron desde el último que se escribió.
     */
    public allow(type: string, nowMs: number): number | null {
        const last = this.last.get(type);
        if (last !== undefined && nowMs - last < this.intervalMs && nowMs >= last) {
            this.suppressed.set(type, (this.suppressed.get(type) ?? 0) + 1);
            return null;
        }
        const muted = this.suppressed.get(type) ?? 0;
        this.last.set(type, nowMs);
        this.suppressed.delete(type);
        return muted;
    }
}
