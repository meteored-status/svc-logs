/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 1e920c57d71190d64a7b9a1211e56741
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDevelopment} from "@mr/core-dev/manifest/development";

import type {IManifestLegacy} from "./legacy";

class ManifestWorkspaceDevelopmentLoader {
    /* INSTANCE */
    public get default(): IManifestDevelopment {
        return {
            enabled: true,
        };
    }

    /**
     * Normaliza y valida la sección `devel` del workspace.
     *
     * @param devel - Datos parciales de la sección `devel`.
     * @returns Configuración de desarrollo completa y normalizada.
     */
    public check(devel: Partial<IManifestDevelopment>={}): IManifestDevelopment {
        const data = this.default;
        if (devel.enabled !== undefined) {
            data.enabled = devel.enabled;
        }

        return data;
    }

    /**
     * Migra la sección `devel` desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Configuración de desarrollo migrada.
     */
    public fromLegacy(config: Partial<IManifestLegacy>): IManifestDevelopment {
        return {
            enabled: config.devel ?? true,
        };
    }
}

export default new ManifestWorkspaceDevelopmentLoader();
