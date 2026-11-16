/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: b33642c53118de8f978b7e669ed33f4b
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

/**
 * Servicio de acceso a cookies, sea cual sea el mecanismo (p. ej. `document.cookie`).
 *
 * @property set - Escribe la cookie `key`. Sin `expires` es de sesión; `path` por defecto `/`.
 * @property get - Valor de la cookie `key`, o `undefined` si no existe.
 * @property remove - Borra la cookie `key`; `domain` y `path` tienen que ser los de `set`.
 */
export interface IServiceCookie {
    set(key: string, value: string, expires?: Date, domain?: string, path?: string): void;
    get(key: string): string | undefined;
    remove(key: string, domain?: string, path?: string): void;
}
