import type {IManifestDeploymentStorageBuckets} from "@mr/cli/manifest/deployment/storage/buckets";

class ManifestWorkspaceDeploymentStorageBucketsLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentStorageBuckets {
        return {
            produccion: [],
            test: [],
        };
    }

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
