/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: bd5cd2638d5b99a22e9a70e778c6e85b
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {readJSON} from "../../../utiles/fs";

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
        const data: ILang[] = await readJSON("@mr/cli/src/mrlang/clases-v2/lang/assets/langs.json");
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
