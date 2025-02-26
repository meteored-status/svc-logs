export interface IManifestDeploymentRun {
    enabled: boolean;
}

export class ManifestDeploymentRun implements IManifestDeploymentRun {
    /* STATIC */
    public static build(deploy: IManifestDeploymentRun): ManifestDeploymentRun {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;

    protected constructor(deploy: IManifestDeploymentRun) {
        this.enabled = deploy.enabled;
    }

    public toJSON(): IManifestDeploymentRun {
        return {
            enabled: this.enabled,
        };
    }
}
