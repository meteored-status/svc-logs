export interface IManifestDeploymentBuild {
    enabled: boolean;
    force: boolean;
}

export class ManifestDeploymentBuild implements IManifestDeploymentBuild {
    /* STATIC */
    public static build(deploy: IManifestDeploymentBuild): ManifestDeploymentBuild {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;
    public force: boolean;

    protected constructor(deploy: IManifestDeploymentBuild) {
        this.enabled = deploy.enabled;
        this.force = deploy.force;
    }

    public toJSON(): IManifestDeploymentBuild {
        return {
            enabled: this.enabled,
            force: this.force,
        };
    }
}
