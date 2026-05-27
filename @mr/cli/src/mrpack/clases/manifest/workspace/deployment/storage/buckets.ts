/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: f95c4bb61b3ee76fb25f20c74544f91e
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentStorageBuckets} from "@mr/core-dev/manifest/deployment/storage/buckets";

class ManifestWorkspaceDeploymentStorageBucketsLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentStorageBuckets {
        return {
            produccion: [],
            test: [],
        };
    }

    /**
     * Normaliza y valida la configuración de buckets de storage.
     *
     * @param buckets - Datos parciales de la configuración de buckets.
     * @returns Configuración de buckets completa y normalizada.
     */
    public check(buckets: Partial<IManifestDeploymentStorageBuckets>): IManifestDeploymentStorageBuckets {
        const data = this.default;
        if (buckets.produccion) {
            if (Array.isArray(buckets.produccion)) {
                data.produccion = buckets.produccion;
            } else {
                data.produccion = [buckets.produccion];
            }
        }
        if (buckets.test) {
            if (Array.isArray(buckets.test)) {
                data.test = buckets.test;
            } else {
                data.test = [buckets.test];
            }
        }

        return data;
    }
}

export default new ManifestWorkspaceDeploymentStorageBucketsLoader();
