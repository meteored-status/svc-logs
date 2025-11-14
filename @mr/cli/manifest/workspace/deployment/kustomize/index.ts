export interface IManifestDeploymentKustomize {
    name: string;
    dir?: string;
    credenciales?: Record<string, string>;
    ssl?: Record<string, string>;
}

export class ManifestDeploymentKustomize implements IManifestDeploymentKustomize {
    /* INSTANCE */
    public name: string;
    public dir?: string;
    public credenciales?: Record<string, string>;
    public ssl?: Record<string, string>;

    protected constructor(deploy: IManifestDeploymentKustomize) {
        this.name = deploy.name;
        this.dir = deploy.dir;
        this.credenciales = deploy.credenciales;
        this.ssl = deploy.ssl;
    }

    /* STATIC */
    public static build(deploy: IManifestDeploymentKustomize): ManifestDeploymentKustomize {
        return new this(deploy);
    }

    public toJSON(): IManifestDeploymentKustomize {
        return {
            name: this.name,
            dir: this.dir,
            credenciales: this.credenciales,
            ssl: this.ssl,
        };
    }
}
