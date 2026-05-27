export type Egress = "all-traffic" | "private-ranges-only";

export const Egress: {
    readonly all: Egress;
    readonly private: Egress;
} = {
    all: "all-traffic",
    private: "private-ranges-only",
};

export type Ingress = "all" | "internal-and-cloud-load-balancing";

export const Ingress: {
    readonly all: Ingress;
    readonly internal: Ingress;
} = {
    all: "all",
    internal: "internal-and-cloud-load-balancing",
};

export interface IManifestDeploymentLambda {
    egress?: Egress;
    ingress: Ingress;
}

/**
 * Modelo de un elemento de `deploy.annotations` en `mrpack.json`.
 */
export class ManifestDeploymentLambda implements IManifestDeploymentLambda {
    /* STATIC */
    public static build(deploy: IManifestDeploymentLambda): ManifestDeploymentLambda {
        return new this(deploy);
    }

    /* INSTANCE */
    public egress?: Egress;
    public ingress: Ingress;

    protected constructor(lambda: IManifestDeploymentLambda) {
        this.egress = lambda.egress;
        this.ingress = lambda.ingress;
    }

    public toJSON(): IManifestDeploymentLambda {
        return {
            egress: this.egress,
            ingress: this.ingress,
        };
    }
}
