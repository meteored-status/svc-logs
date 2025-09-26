import {type IManifestDeploymentStorageBuckets, ManifestDeploymentStorageBuckets} from "./buckets";

export interface IManifestDeploymentStorage {
    buckets: IManifestDeploymentStorageBuckets;
    bundle: string;
    subdirPrefix: string;
    subdir?: string;
    subdirPostfix: string;
    previo?: string[]; // si cambiamos el directorio de los archivos, mantenemos los directorios anteriores para seguir teniendo acceso a los datos
}

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
