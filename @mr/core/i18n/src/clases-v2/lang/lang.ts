/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 33343199bd5109fba643ad1b2e17697a
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {readJSON} from "@mr/core-cli/fs";

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

    private static CATALOG: Record<string, ILang>|null = null;

    /**
     * Carga el catálogo de idiomas en memoria para consultas posteriores.
     */
    private static async loadCatalog(): Promise<void> {
        // Ruta desde la raíz del monorepo, que es el cwd que fija `main.ts`. Es un asset del
        // propio paquete, pero no se puede resolver contra `__dirname`: el bundle vive en
        // `bin/min/` y el `.json` se queda en `src/`, así que la única referencia estable es esta.
        const data: ILang[] = await readJSON("@mr/core/i18n/src/clases-v2/lang/assets/langs.json");
        this.CATALOG = {};
        for (const lang of data) {
            this.CATALOG[lang.code] = lang;
        }
    }

    /**
     * Obtiene un idioma por código y aplica fallback a `en-US` si no existe.
     *
     * @param code - Código solicitado.
     * @returns Instancia de idioma resuelta.
     */
    public static async getByCode(code: string): Promise<Lang> {
        if (!this.CATALOG) {
            await this.loadCatalog();
        }
        const data = this.CATALOG![code]??this.CATALOG!["en-US"];
        if (!data) {
            throw new Error(`No se ha encontrado el idioma con código ${code}`);
        }
        return new Lang(data);
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
    public get parent(): Promise<Lang> | null {
        if (!this.parentCode) {
            return null;
        }
        return Lang.getByCode(this.parentCode);
    }
}
