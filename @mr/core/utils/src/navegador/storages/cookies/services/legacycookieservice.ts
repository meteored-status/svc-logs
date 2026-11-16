/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 166ed1663a807a420ad6cd56f31b441a
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {IServiceCookie} from "./base.ts";

/**
 * Servicio de cookies sobre `document.cookie`.
 * Acceso de bajo nivel a `document.cookie`: una cookie por nombre, con el valor codificado
 * con `encodeURIComponent`.
 */
class LegacyCookieService implements IServiceCookie {
    /* INSTANCE */

    /**
     * Escribe la cookie. Sin `expires` es de sesión. Siempre `secure`; `path` por defecto `/`.
     */
    public set(key: string, value: string, expires?: Date, domain?: string, path?: string): void {
        const componentes: string[] = [`${key}=${encodeURIComponent(value)}`];
        if (expires !== undefined) {
            componentes.push(`expires=${expires.toUTCString()}`);
        }
        if (domain !== undefined && domain.length > 0) {
            componentes.push(`domain=${domain}`);
        }
        componentes.push(`path=${path ?? "/"}`);
        componentes.push("secure");

        document.cookie = componentes.join("; ");
    }

    /**
     * Valor de la cookie, o `undefined` si no existe. Puede lanzar si el valor está mal codificado.
     */
    public get(key: string): string | undefined {
        for (const cookie of document.cookie.split(";")) {
            const [nombre, valor] = cookie.trim().split("=");
            if (nombre === key) {
                return decodeURIComponent(valor ?? "");
            }
        }
        return undefined;
    }

    /**
     * Borra la cookie escribiéndola ya caducada. `domain` y `path` tienen que ser los de `set`.
     */
    public remove(key: string, domain?: string, path?: string): void {
        this.set(key, "", new Date(Date.now() - 86400000), domain, path);
    }
}

const cookies = new LegacyCookieService();

export default cookies;
