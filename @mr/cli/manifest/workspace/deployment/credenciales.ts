export interface IManifestDeploymentCredenciales {
    source: string;
    target: string;
}

export class ManifestDeploymentCredenciales implements IManifestDeploymentCredenciales {
    /* STATIC */
    public static build(credenciales: IManifestDeploymentCredenciales): ManifestDeploymentCredenciales {
        return new this(credenciales);
    }

    /* INSTANCE */
    public source: string;
    public target: string;

    protected constructor(credenciales: IManifestDeploymentCredenciales) {
        this.source = credenciales.source;
        this.target = credenciales.target;
    }

    public toJSON(): IManifestDeploymentCredenciales {
        return {
            source: this.source,
            target: this.target,
        };
    }
}
