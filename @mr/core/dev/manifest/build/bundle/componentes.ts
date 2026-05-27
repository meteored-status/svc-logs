/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 3b640713fb89af67e26a49df15e2b488
 * Versión: 2026.5.21+1-josantoniojimnez
 */

/**
 * Modo de procesado CSS para los componentes del bundle.
 *
 * - `""` — sin CSS; los estilos no se incluyen en el bundle.
 * - `"inyectado"` — inyectado en el DOM con `<style>` vía JavaScript en runtime.
 * - `"independiente"` — emitido como ficheros `.css` independientes.
 * - `"critical"` — CSS crítico que el servidor inyecta inline en el `<head>`.
 * - `"string"` — exportado como string de texto (SSR o componentes aislados).
 */
export type ManifestBuildComponentesCSS = "" | "inyectado" | "independiente" | "critical" | "string";

export const ManifestBuildComponentesCSS: {
    readonly DESACTIVADO: ManifestBuildComponentesCSS;
    readonly INYECTADO: ManifestBuildComponentesCSS;
    readonly INDEPENDIENTE: ManifestBuildComponentesCSS;
    readonly CRITICAL: ManifestBuildComponentesCSS;
    readonly STRING: ManifestBuildComponentesCSS;
} = {
    DESACTIVADO: "",
    INYECTADO: "inyectado",
    INDEPENDIENTE: "independiente",
    CRITICAL: "critical",
    STRING: "string",
};

/**
 * Opciones del pipeline de componentes para un bundle.
 *
 * @property optimizar - Si `true` (por defecto), rspack aplica optimizaciones al procesar componentes.
 * @property pug - Si `true`, los ficheros `.pug` se compilan como plantillas. Por defecto `false`.
 * @property css - Estrategia de procesado y emisión de CSS ({@link ManifestBuildComponentesCSS}). Por defecto `DESACTIVADO`.
 */
export interface IManifestBuildComponentes {
    optimizar: boolean;
    pug: boolean;
    css: ManifestBuildComponentesCSS;
}

/**
 * Modelo de la sección `build.bundle.componentes` de `mrpack.json`.
 *
 * Todos los campos son opcionales en el JSON; `build()` aplica los valores
 * por defecto: `optimizar=true`, `pug=false`, `css=DESACTIVADO`.
 * `toJSON()` omite los campos que coincidan con los valores por defecto.
 */
export class ManifestBuildComponentes implements IManifestBuildComponentes {
    /* STATIC */
    public static build(componentes: Partial<IManifestBuildComponentes> = {}): ManifestBuildComponentes {
        return new ManifestBuildComponentes(componentes);
    }

    /* INSTANCE */
    public optimizar: boolean;
    public pug: boolean;
    public css: ManifestBuildComponentesCSS;

    protected constructor(componentes: Partial<IManifestBuildComponentes>) {
        this.optimizar = componentes.optimizar ?? true;
        this.pug = componentes.pug ?? false;
        this.css = componentes.css ?? ManifestBuildComponentesCSS.DESACTIVADO;
    }

    public toJSON(): Partial<IManifestBuildComponentes>|undefined {
        const salida: Partial<IManifestBuildComponentes> = {};
        if (!this.optimizar) {
            salida.optimizar = false;
        }
        if (this.pug) {
            salida.pug = true;
        }
        if (this.css!=ManifestBuildComponentesCSS.DESACTIVADO) {
            salida.css = this.css;
        }
        if (Object.keys(salida).length==0) {
            return;
        }
        return salida;
    }
}
