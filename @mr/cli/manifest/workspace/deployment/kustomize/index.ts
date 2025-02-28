export interface IManifestDeploymentKustomize {
    legacy?: string;
}

export class ManifestDeploymentKustomize implements IManifestDeploymentKustomize {
    /* STATIC */
    public static build(deploy: IManifestDeploymentKustomize): ManifestDeploymentKustomize {
        return new this(deploy);
    }

    /* INSTANCE */
    public legacy?: string;

    protected constructor(deploy: IManifestDeploymentKustomize) {
        this.legacy = deploy.legacy;
    }

    public toJSON(): IManifestDeploymentKustomize {
        return {
            legacy: this.legacy,
        };
    }
}
