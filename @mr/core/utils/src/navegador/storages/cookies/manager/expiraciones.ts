/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: adc5c95a3e7370540e67beeeac9a4a49
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

export const enum TTiempo {
    minuto = 60000,
    hora = 3600000,
    dia = 86400000,
    mes = 2592000000,
    anno = 31536000000,
}

/**
 * Cuándo caduca una cookie.
 *
 * - `number`: milisegundos desde ahora (ver {@link TTiempo}).
 * - `Date`: fecha fija.
 * - función: calcula la fecha en cada escritura.
 * - `"sesion"`: sin `expires`, dura lo que la sesión del navegador.
 */
export type Expiracion = number | Date | (() => Date) | "sesion";

/**
 * Fecha de caducidad de una {@link Expiracion}, o `undefined` si es de sesión.
 */
export function resolverExpiracion(expiracion?: Expiracion): Date | undefined {
    if (expiracion === undefined || expiracion === "sesion") {
        return undefined;
    }
    if (expiracion instanceof Date) {
        return expiracion;
    }
    if (typeof expiracion === "function") {
        return expiracion();
    }
    return new Date(Date.now() + expiracion);
}
