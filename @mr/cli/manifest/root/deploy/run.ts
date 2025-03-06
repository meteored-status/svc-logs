export interface IManifestDeploymentRun {
    enabled: boolean;
    latest: boolean;
}

export class ManifestDeploymentRun implements IManifestDeploymentRun {
    /* STATIC */
    public static build(deploy: IManifestDeploymentRun): ManifestDeploymentRun {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;
    public latest: boolean;

    protected constructor(deploy: IManifestDeploymentRun) {
        this.enabled = deploy.enabled;
        this.latest = deploy.latest;
    }

    public toJSON(): IManifestDeploymentRun {
        return {
            enabled: this.enabled,
            latest: this.latest,
        };
    }
}
