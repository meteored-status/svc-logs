/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 2939d632334ca520fcbcbaa5b7915cca
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import {type IManifestBuildComponentes, ManifestBuildComponentes} from "./componentes.ts";

/**
 * Configuración base de un bundle de assets.
 * Compartida por el bundle principal (`build.bundle`) y por los bundles web adicionales (`build.bundle.web`).
 *
 * @property componentes - Pipeline de componentes (optimización, Pug, CSS).
 * @property entries - Mapa de entradas `{ nombre: ruta }`. Si se omite, rspack usa las entradas por defecto.
 * @property prefix - Prefijo de los ficheros de salida. Útil para versionar o separar bundles.
 * @property source_map - Módulos para los que se genera source map explícito.
 */
export interface IManifestBuildBundleBase {
    componentes?: Partial<IManifestBuildComponentes>;
    entries?: Record<string, string>;
    prefix?: string;
    source_map?: string[];
}

/**
 * Modelo base para un nodo de bundle de assets.
 * No se instancia directamente; se usa como base de {@link ManifestBuildBundle}.
 */
export class ManifestBuildBundleBase implements IManifestBuildBundleBase {
    /* STATIC */
    public static build(bundle?: IManifestBuildBundleBase): ManifestBuildBundleBase|undefined {
        if (bundle==undefined) {
            return;
        }

        return new this(bundle);
    }

    /* INSTANCE */
    public componentes: ManifestBuildComponentes;
    public entries?: Record<string, string>;
    public prefix?: string;
    public source_map?: string[];

    protected constructor(bundle: IManifestBuildBundleBase) {
        this.componentes = ManifestBuildComponentes.build(bundle.componentes);
        this.entries = bundle.entries;
        this.prefix = bundle.prefix;
        this.source_map = bundle.source_map;
    }

    public toJSON(): Partial<IManifestBuildBundleBase>|undefined {
        const salida: Partial<IManifestBuildBundleBase> = {};
        const componentes = this.componentes.toJSON();
        if (componentes!=undefined) {
            salida.componentes = componentes;
        }
        if (this.entries!=undefined) {
            salida.entries = this.entries;
        }
        if (this.prefix!=undefined) {
            salida.prefix = this.prefix;
        }
        if (this.source_map!=undefined) {
            salida.source_map = this.source_map;
        }
        if (Object.keys(salida).length==0) {
            return;
        }
        return salida;
    }
}
