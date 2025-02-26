import type {IManifestDeploymentStorage} from "@mr/cli/manifest/deployment/storage";

import type {IManifestLegacy} from "../legacy";

export class ManifestWorkspaceDeploymentStorageLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentStorage {
        return {
            buckets: [],
            bundle: "bundle/",
            subdirPrefix: "",
            subdirPostfix: "",
        };
    }

    public static check(storage?: Partial<IManifestDeploymentStorage>): IManifestDeploymentStorage|undefined {
        if (storage==undefined) {
            return;
        }
        const data = this.DEFAULT;
        if (storage.buckets!=undefined) {
            if (Array.isArray(storage.buckets)) {
                data.buckets = storage.buckets;
            } else {
                data.buckets = [storage.buckets];
            }
        }
        if (storage.bundle!=undefined) {
            data.bundle = storage.bundle;
        }
        if (storage.subdirPrefix!=undefined) {
            data.subdirPrefix = storage.subdirPrefix;
        }
        if (storage.subdir!=undefined) {
            data.subdir = storage.subdir;
        }
        if (storage.subdirPostfix!=undefined) {
            data.subdirPostfix = storage.subdirPostfix;
        }
        if (storage.previo!=undefined) {
            if (Array.isArray(storage.previo)) {
                data.previo = storage.previo;
            } else {
                data.previo = [storage.previo];
            }
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacy>): IManifestDeploymentStorage {
        if (config.storage==undefined) {
            throw new Error(`ManifestDeployment: config.storage no definido para "${config.runtime}"`);
        }

        let bundle: string;
        let subdirPrefix: string;
        let subdirPostfix: string;
        if (config.storage.subdir==undefined) {
            subdirPrefix = "";
        } else {
            subdirPrefix = `${config.storage.subdir}/`;
        }
        if (config.storage.subdir2==undefined) {
            bundle = "";
            subdirPostfix = "/output";
        } else if (config.storage.subdir2.length==0) {
            bundle = "bundle/";
            subdirPostfix = "";
        } else {
            bundle = "bundle/";
            subdirPostfix = `/${config.storage.subdir2}`;
        }

        return {
            buckets: !Array.isArray(config.storage.buckets) ? [config.storage.buckets] : config.storage.buckets,
            bundle,
            subdirPrefix,
            subdir: config.storage.package,
            subdirPostfix,
            previo: undefined,
        };
    }

    /* INSTANCE */
}
