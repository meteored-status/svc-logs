import type {IManifestDeploymentStorageBuckets} from "@mr/cli/manifest/deployment/storage/buckets";

export class ManifestWorkspaceDeploymentStorageBucketsLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentStorageBuckets {
        return {
            produccion: [],
            test: [],
        };
    }

    public static check(buckets: Partial<IManifestDeploymentStorageBuckets>): IManifestDeploymentStorageBuckets {
        const data = this.DEFAULT;
        if (buckets.produccion!=undefined) {
            if (Array.isArray(buckets.produccion)) {
                data.produccion = buckets.produccion;
            } else {
                data.produccion = [buckets.produccion];
            }
        }
        if (buckets.test!=undefined) {
            if (Array.isArray(buckets.test)) {
                data.test = buckets.test;
            } else {
                data.test = [buckets.test];
            }
        }

        return data;
    }

    /* INSTANCE */
}
