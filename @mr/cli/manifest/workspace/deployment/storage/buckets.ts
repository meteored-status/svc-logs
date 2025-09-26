export interface IManifestDeploymentStorageBuckets {
    produccion: string[];
    test: string[];
}

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
