/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 11f4b318f4ddc166785f15a2e846ff2f
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import {type IManifestDeploymentStorageBuckets, ManifestDeploymentStorageBuckets} from "./buckets.ts";

/**
 * Configuración de almacenamiento en Google Cloud Storage para workspaces de tipo `BROWSER`.
 *
 * @property buckets - Buckets GCS de destino por entorno.
 * @property bundle - Subdirectorio de `output/` que contiene los assets a subir.
 * @property subdirPrefix - Prefijo que se antepone al subdirectorio de destino en el bucket.
 * @property subdirPostfix - Sufijo que se añade al subdirectorio de destino en el bucket.
 * @property subdir - Directorio de destino en el bucket. Por defecto el nombre del workspace.
 * @property previo - Directorios anteriores a mantener accesibles (evita romper URLs antiguas).
 */
export interface IManifestDeploymentStorage {
    buckets: IManifestDeploymentStorageBuckets;
    bundle: string;
    subdirPrefix: string;
    subdir?: string;
    subdirPostfix: string;
    previo?: string[];
}

/**
 * Modelo de la sección `deploy.storage` de `mrpack.json`.
 * Solo aplica a workspaces con `deploy.type = BROWSER`.
 */
export class ManifestDeploymentStorage implements IManifestDeploymentStorage {
    /* STATIC */
    public static build(storage?: IManifestDeploymentStorage): ManifestDeploymentStorage|undefined {
        if (storage==undefined) {
            return;
        }

        return new this(storage);
    }

    /* INSTANCE */
    public buckets: ManifestDeploymentStorageBuckets;
    public bundle: string;
    public subdirPrefix: string;
    public subdir?: string;
    public subdirPostfix: string;

    protected constructor(storage: IManifestDeploymentStorage) {
        this.buckets = ManifestDeploymentStorageBuckets.build(storage.buckets);
        this.bundle = storage.bundle;
        this.subdirPrefix = storage.subdirPrefix;
        this.subdir = storage.subdir;
        this.subdirPostfix = storage.subdirPostfix;
    }

    public toJSON(): IManifestDeploymentStorage {
        return {
            buckets: this.buckets.toJSON(),
            bundle: this.bundle,
            subdirPrefix: this.subdirPrefix,
            subdir: this.subdir,
            subdirPostfix: this.subdirPostfix,
        };
    }
}
