/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 993027944c710bee0a94d48cddc60892
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestBuildBundleBase,} from "@mr/core-dev/manifest/build/bundle/base";

import type {IManifestLegacyBundleBase} from "../../legacy";
import ManifestWorkspaceBuildComponentesLoader from "./componentes";

/**
 * Cargador base para la configuración de bundle de build.
 * Normaliza las entradas, componentes, source maps y prefijos.
 */
export class ManifestWorkspaceBuildBundleBaseLoader {
    /* INSTANCE */
    public get default(): IManifestBuildBundleBase {
        return {};
    }

    /**
     * Normaliza y valida una configuración de bundle base.
     *
     * @param bundle - Datos parciales de la configuración de bundle.
     * @returns Configuración de bundle normalizada, o `undefined` si el objeto resultante está vacío.
     */
    public check(bundle?: Partial<IManifestBuildBundleBase>): IManifestBuildBundleBase|undefined {
        if (!bundle) {
            return;
        }

        const data = this.default;
        if (bundle.componentes) {
            data.componentes = ManifestWorkspaceBuildComponentesLoader.check(bundle.componentes);
        }
        if (bundle.entries && Object.keys(bundle.entries).length>0) {
            data.entries = bundle.entries;
        }
        if (bundle.prefix) {
            data.prefix = bundle.prefix;
        }
        if (bundle.source_map && bundle.source_map.length>0) {
            data.source_map = bundle.source_map;
        }

        if (Object.keys(data).length===0) {
            return;
        }

        return data;
    }

    /**
     * Migra la configuración de bundle base desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Configuración de bundle migrada, o `undefined` si no hay datos relevantes.
     */
    public fromLegacy(config: Partial<IManifestLegacyBundleBase>): IManifestBuildBundleBase|undefined {
        if (!config.source_map && !config.componentes && !config.entries && !config.prefix) {
            return;
        }

        let entries: Record<string, string>|undefined;
        if (config.entries && Object.keys(config.entries).length>0) {
            entries = config.entries;
        }
        let prefix: string|undefined;
        if (config.prefix && config.prefix.length>0) {
            prefix = config.prefix;
        }
        let sourceMap: string[]|undefined;
        if (config.source_map) {
            if (Array.isArray(config.source_map)) {
                sourceMap = config.source_map;
            } else {
                sourceMap = [config.source_map];
            }
        }

        return {
            componentes: ManifestWorkspaceBuildComponentesLoader.fromLegacy(config.componentes),
            entries,
            prefix,
            source_map: sourceMap,
        };
    }
}

export default new ManifestWorkspaceBuildBundleBaseLoader();
