/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 80a822c60d99dc1ed01ad2282f3b6847
 * Versión: 2026.5.27+1-josantoniojimnez
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
