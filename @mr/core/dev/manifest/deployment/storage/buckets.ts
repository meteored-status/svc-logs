/**
 * Listas de buckets de Google Cloud Storage donde se desplegará el artefacto estático.
 *
 * @property produccion - Buckets donde se subirán los assets en producción.
 * @property test - Buckets donde se subirán los assets en test/staging.
 */
export interface IManifestDeploymentStorageBuckets {
    produccion: string[];
    test: string[];
}

/**
 * Modelo de `deploy.storage.buckets` en `mrpack.json`.
 */
export class ManifestDeploymentStorageBuckets implements IManifestDeploymentStorageBuckets {
    /* STATIC */
    public static build(buckets: IManifestDeploymentStorageBuckets): ManifestDeploymentStorageBuckets {
        return new this(buckets);
    }

    /* INSTANCE */
    public produccion: string[];
    public test: string[];

    protected constructor(storage: IManifestDeploymentStorageBuckets) {
        this.produccion = storage.produccion;
        this.test = storage.test;
    }

    public toJSON(): IManifestDeploymentStorageBuckets {
        return {
            produccion: this.produccion,
            test: this.test,
        };
    }
}
