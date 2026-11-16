/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: c90a2ce9c5e1b5dabcfe06a432c8ccf9
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Réplica de `services-comun/modules/utiles/log` para el arnés de pruebas: no escribe en consola y deja los
 * avisos registrados en {@link avisos} para poder comprobarlos.
 */

/** Avisos (`warning`) emitidos desde el último {@link limpiarAvisos}, con sus argumentos unidos en texto. */
export const avisos: string[] = [];

export function limpiarAvisos(): void {
    avisos.length = 0;
}

export function warning(...args: unknown[]): void {
    avisos.push(args.map(String).join(" "));
}

export function info(..._args: unknown[]): void {
    // sin salida
}

export function error(..._args: unknown[]): void {
    // sin salida
}

export function formatTiempo(ms: number): string {
    return `${ms}ms`;
}
