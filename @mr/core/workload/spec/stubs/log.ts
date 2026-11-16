/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: a37d788ff546a7e70e6b36f9ee7c7066
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Réplica de `services-comun/modules/utiles/log` para el arnés de pruebas: no escribe en consola y deja los
 * avisos registrados en {@link avisos} para poder comprobarlos.
 */

/** Avisos (`warning`) emitidos desde el último {@link limpiarAvisos}, con sus argumentos unidos en texto. */
export const avisos: string[] = [];

/** Mensajes `info` emitidos desde el último {@link limpiarAvisos}. */
export const infos: string[] = [];

export function limpiarAvisos(): void {
    avisos.length = 0;
    infos.length = 0;
}

export function warning(...args: unknown[]): void {
    avisos.push(args.map(String).join(" "));
}

export function info(...args: unknown[]): void {
    infos.push(args.map(String).join(" "));
}

export function error(..._args: unknown[]): void {
    // sin salida
}

export function formatMemoria(bytes: number): string {
    return `${bytes}B`;
}

export function formatTiempo(ms: number): string {
    return `${ms}ms`;
}
