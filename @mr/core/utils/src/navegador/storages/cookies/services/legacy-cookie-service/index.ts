/**
 * Editor: miguel
 * Fecha: Wed, 18 Nov 2026 11:11:39 GMT
 * Hash: 622b07fa32395972d3fc6b5e9e558676
 * Versión: 2026.11.18+1-miguel
 * Anterior: 2026.11.16+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {leerCookie} from "./acciones";
import type {IServiceCookie} from "../base";

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
     * Valor de la cookie, o `undefined` si no existe. Ver {@link leerCookie}.
     */
    public get(key: string): string | undefined {
        return leerCookie(document.cookie, key);
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
