/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: e51d0d078d198237793528dfe12a923f
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IManifestBuildDatabase} from "@mr/core-dev/manifest/build/database";

class ManifestWorkspaceBuildDatabaseLoader {
    /* INSTANCE */
    public get default(): IManifestBuildDatabase|undefined {
        return undefined;
    }

    /**
     * Normaliza y valida la configuración de base de datos del build.
     *
     * @param database - Datos parciales de la configuración de base de datos.
     * @returns Configuración de base de datos completa, o `undefined` si no se proporciona.
     */
    public check(database?: Partial<IManifestBuildDatabase>): IManifestBuildDatabase|undefined {
        if (!database) {
            return this.default;
        }
        const data = this.default ?? {};
        if (database.produccion) {
            data.produccion = database.produccion;
        }
        if (database.test) {
            data.test = database.test;
        }

        return data;
    }
}

export default new ManifestWorkspaceBuildDatabaseLoader();
