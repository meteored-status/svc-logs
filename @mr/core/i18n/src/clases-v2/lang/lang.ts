/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: c96df0287c63fb2a70e33be2a90b1612
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.17+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {langChain} from "../../../modules/util/lang";
import catalogo from "./assets/langs.json";

/**
 * Modelo del catálogo de idiomas cargado desde `assets/langs.json`.
 *
 * @property code - Código único del idioma (por ejemplo `es-ES`).
 * @property parent_code - Código del idioma padre en la jerarquía de fallback.
 */
interface ILang {
    code: string;
    parent_code?: string;
}

/**
 * Resuelve idiomas y su cadena de herencia para fallback de traducciones.
 */
export class Lang {
    /* STATIC */

    /**
     * El catálogo **se importa, no se lee**, y eso es lo que quita de en medio el problema de la
     * ruta. Leerlo con `readJSON()` obligaba a nombrar el fichero desde algún directorio de
     * referencia —el cwd, `__dirname`— y ninguno servía: el bundle vive en `bin/min/` y el `.json`
     * se queda en `src/`, así que la ruta que había era la del monorepo de origen y aquí no
     * resolvía. Con un import estático el empaquetador lo incrusta (son 10 kB) y no hay ninguna
     * ruta que resolver en ejecución, ni E/S, ni nada asíncrono que esperar.
     */
    private static readonly CATALOG: Record<string, ILang> = Object.fromEntries(
        (catalogo as ILang[]).map((lang) => [lang.code, lang]),
    );

    /**
     * El catálogo indexado en minúsculas, porque en BCP 47 la caja no distingue idiomas: `ca-es` y `ca-ES`
     * son el mismo. Sin esto, un `.json` escrito con otra caja se comportaba como un código desconocido.
     */
    private static readonly INDICE: Record<string, string> = Object.fromEntries(
        Object.keys(this.CATALOG).map((code) => [code.toLowerCase(), code]),
    );

    /**
     * Idioma al que se rinde la jerarquía cuando ya no queda nada por probar.
     */
    private static readonly DEFECTO: string = "en-US";

    /**
     * Obtiene un idioma por código, esté o no en el catálogo.
     *
     * **Un código que el catálogo no conoce ya no se sustituye por `en-US`.** Eso era lo que hacía que un
     * tag BCP 47 cualquiera no llegara ni a intentarse: `getByCode("ca-ES-valencia")` devolvía el inglés, y
     * quien recorriera la jerarquía a partir de ahí estaba recorriendo la del inglés. Ahora se sintetiza un
     * idioma con ese código y con el padre que dice el truncado de subtags de RFC 4647 —`ca-ES-valencia` →
     * `ca-ES` → `ca`—, así que la cadena entra en el catálogo en cuanto alcanza un código declarado y sigue
     * por la herencia de siempre.
     *
     * La cadena **siempre termina**: cada salto acorta el código, y el último salto posible es a `en-US`,
     * que está en el catálogo y no tiene padre.
     *
     * @param code - Código solicitado.
     * @returns Instancia de idioma resuelta.
     */
    public static getByCode(code: string): Lang {
        const real = this.INDICE[code.toLowerCase()];
        if (real != undefined) {
            return new Lang(this.CATALOG[real]);
        }

        return new Lang({code, parent_code: this.padreDe(code)});
    }

    /**
     * El padre de un código que no está en el catálogo: el siguiente de su cadena de truncado o, si ya no
     * queda ninguno, el idioma por defecto.
     *
     * @param code - Código no declarado en el catálogo.
     * @returns El código del padre, o `undefined` si el propio código ya es el defecto.
     */
    private static padreDe(code: string): string|undefined {
        const siguiente = langChain(code).at(1);
        if (siguiente != undefined) {
            return siguiente;
        }

        return code.toLowerCase() != this.DEFECTO.toLowerCase() ? this.DEFECTO : undefined;
    }

    /* INSTANCE */

    /**
     * @param data - Datos brutos del idioma.
     */
    private constructor(private readonly data: ILang) {
    }

    /**
     * Código del idioma actual.
     */
    public get code(): string {
        return this.data.code;
    }

    /**
     * Código del idioma padre, si existe.
     */
    public get parentCode(): string | undefined {
        return this.data.parent_code;
    }

    /**
     * Idioma padre resuelto; `null` cuando el idioma no tiene jerarquía superior.
     */
    public get parent(): Lang | null {
        if (!this.parentCode) {
            return null;
        }
        return Lang.getByCode(this.parentCode);
    }
}
