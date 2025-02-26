export interface IManifestDevelopment {
    enabled: boolean;
}

export class ManifestDevelopment implements IManifestDevelopment {
    /* STATIC */
    public static build(devel: IManifestDevelopment): ManifestDevelopment {
        return new this(devel);
    }

    /* INSTANCE */
    public enabled: boolean;

    protected constructor(devel: IManifestDevelopment) {
        this.enabled = devel.enabled;
    }

    public toJSON(): IManifestDevelopment {
        return {
            enabled: this.enabled,
        };
    }
}
