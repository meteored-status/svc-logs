export interface IManifestDeploymentKustomize {
    legacy?: string;
    credenciales?: Record<string, string>;
    ssl?: Record<string, string>;
}

export class ManifestDeploymentKustomize implements IManifestDeploymentKustomize {
    /* STATIC */
    public static build(deploy: IManifestDeploymentKustomize): ManifestDeploymentKustomize {
        return new this(deploy);
    }

    /* INSTANCE */
    public legacy?: string;
    public credenciales?: Record<string, string>;
    public ssl?: Record<string, string>;

    protected constructor(deploy: IManifestDeploymentKustomize) {
        this.legacy = deploy.legacy;
        this.credenciales = deploy.credenciales;
        this.ssl = deploy.ssl;
    }

    public toJSON(): IManifestDeploymentKustomize {
        return {
            legacy: this.legacy,
            credenciales: this.credenciales,
            ssl: this.ssl,
        };
    }
}
