/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 2e208e2f533d1c321c584ed1e2da68a5
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {CookieManager, type ICookieConfig, type IEsquemaCookies} from "./manager";

export abstract class Cookies {
    /* INSTANCE */
    public readonly manager: CookieManager<Record<PropertyKey, ICookieConfig>>;

    protected constructor(esquema: IEsquemaCookies) {
        this.manager = new CookieManager(esquema);
    }
}

/**
 * Método decorador para la cookie.
 */
export function cookie(clave: PropertyKey) {
    return (_: unknown) => ({
        get(this: Cookies): never {
            return this.manager.get(clave) as never;
        },
        set(this: Cookies, valor: never) {
            this.manager.set(clave, valor);
        },
    });
}
