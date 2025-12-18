import type {IManifestDeploymentStorage} from "@mr/cli/manifest/deployment/storage";
import type {IManifestDeploymentStorageBuckets} from "@mr/cli/manifest/deployment/storage/buckets";

import type {IManifestDeploymentStorageLegacy, IManifestLegacy} from "../../legacy";
import ManifestWorkspaceDeploymentStorageBucketsLoader from "./buckets";

class ManifestWorkspaceDeploymentStorageLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentStorage {
        return {
            buckets: ManifestWorkspaceDeploymentStorageBucketsLoader.default,
            bundle: "bundle/",
            subdirPrefix: "",
            subdirPostfix: "",
        };
    }

    public check(storage?: Partial<IManifestDeploymentStorage|IManifestDeploymentStorageLegacy>): IManifestDeploymentStorage|undefined {
        if (!storage) {
            return;
        }
        const data = this.default;
        if (storage.buckets) {
            if (Array.isArray(storage.buckets)) {
                data.buckets = ManifestWorkspaceDeploymentStorageBucketsLoader.check({
                    produccion: storage.buckets,
                    test: storage.buckets,
                });
            } else if (typeof storage.buckets == "object") {
                data.buckets = ManifestWorkspaceDeploymentStorageBucketsLoader.check(storage.buckets as Partial<IManifestDeploymentStorageBuckets>);
            } else {
                data.buckets = ManifestWorkspaceDeploymentStorageBucketsLoader.check({
                    produccion: [storage.buckets],
                    test: [storage.buckets],
                });
            }
        }
        if (storage.bundle!==undefined) {
            data.bundle = storage.bundle;
        }
        if (storage.subdirPrefix) {
            data.subdirPrefix = storage.subdirPrefix;
        }
        if (storage.subdir) {
            data.subdir = storage.subdir;
        }
        if (storage.subdirPostfix) {
            data.subdirPostfix = storage.subdirPostfix;
        }
        if (storage.previo) {
            if (Array.isArray(storage.previo)) {
                data.previo = storage.previo;
            } else {
                data.previo = [storage.previo];
            }
        }

        return data;
    }

    public fromLegacy(config: Partial<IManifestLegacy>): IManifestDeploymentStorage {
        if (!config.storage) {
            throw new Error(`ManifestDeployment: config.storage no definido para "${config.runtime}"`);
        }

        let bundle: string;
        let subdirPrefix: string;
        let subdirPostfix: string;
        let buckets: IManifestDeploymentStorageBuckets;
        if (!config.storage.subdir) {
            subdirPrefix = "";
        } else {
            subdirPrefix = `${config.storage.subdir}/`;
        }
        if (!config.storage.subdir2) {
            bundle = "";
            subdirPostfix = "/output";
        } else if (config.storage.subdir2.length===0) {
            bundle = "bundle/";
            subdirPostfix = "";
        } else {
            bundle = "bundle/";
            subdirPostfix = `/${config.storage.subdir2}`;
        }
        if (!Array.isArray(config.storage.buckets)) {
            buckets = {
                produccion: [config.storage.buckets],
                test: [config.storage.buckets],
            };
        } else {
            buckets = {
                produccion: config.storage.buckets,
                test: config.storage.buckets,
            };
        }

        return {
            buckets,
            bundle,
            subdirPrefix,
            subdir: config.storage.package,
            subdirPostfix,
            previo: undefined,
        };
    }

}

export default new ManifestWorkspaceDeploymentStorageLoader();
