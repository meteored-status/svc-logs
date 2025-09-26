export interface IManifestDeploymentKustomize {
    legacy?: string;
    credenciales?: Record<string, string>;
    ssl?: Record<string, string>;
}

export class ManifestDeploymentKustomize implements IManifestDeploymentKustomize {
    /* INSTANCE */
    public legacy?: string;
    public credenciales?: Record<string, string>;
    public ssl?: Record<string, string>;

    protected constructor(deploy: IManifestDeploymentKustomize) {
        this.legacy = deploy.legacy;
        this.credenciales = deploy.credenciales;
        this.ssl = deploy.ssl;
    }

    /* STATIC */
    public static build(deploy?: IManifestDeploymentKustomize): ManifestDeploymentKustomize|undefined {
        if (!deploy) {
            return undefined;
        }
        return new this(deploy);
    }

    public toJSON(): IManifestDeploymentKustomize {
        return {
            legacy: this.legacy,
            credenciales: this.credenciales,
            ssl: this.ssl,
        };
    }
}
