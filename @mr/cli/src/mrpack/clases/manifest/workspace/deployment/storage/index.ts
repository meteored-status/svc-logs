/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 4791d7af7c0fbc0bdc1e44acff32bbd3
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentStorage} from "@mr/core-dev/manifest/deployment/storage";
import type {IManifestDeploymentStorageBuckets} from "@mr/core-dev/manifest/deployment/storage/buckets";

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

    /**
     * Normaliza y valida la configuración de storage de un workspace.
     *
     * @param storage - Datos parciales de la configuración de storage (acepta formato legacy).
     * @returns Configuración de storage completa y normalizada, o `undefined` si no se proporciona.
     */
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

    /**
     * Migra la configuración de storage desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Configuración de storage migrada al formato actual.
     */
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
