/**
 * Editor: miguel
 * Fecha: Mon, 16 Nov 2026 15:13:05 GMT
 * Hash: d556a19ec5bae02960b2366e96ccebce
 * Versión: 2026.11.16+1-miguel
 * Anterior: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

import {CookieManager, type ICookieConfig, type IEsquemaCookies} from "./manager";

export abstract class Cookies {
    /* INSTANCE */
    public readonly manager: CookieManager<Record<PropertyKey, ICookieConfig>>;

    protected constructor(esquema: IEsquemaCookies) {
        this.manager = new CookieManager(esquema);
    }

    /**
     * Elimina la cookie de `clave` (la misma que se pasa a {@link cookie}), sea cual sea su valor. Después, la propiedad
     * vuelve a dar el valor por defecto.
     */
    public remove(clave: PropertyKey): void {
        this.manager.remove(clave);
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
