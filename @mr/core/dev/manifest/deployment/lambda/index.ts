/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 11:12:48 GMT
 * Hash: 2cb02eb79002e710078bfeaa0ad7e6dc
 * Versión: 2026.5.27+2-josantoniojimnez
 */

/**
 * Política de tráfico saliente de un servicio Cloud Run.
 *
 * - `all`     — todo el tráfico sale a través de la VPC (`"all-traffic"`).
 * - `private` — solo el tráfico a rangos privados sale por la VPC (`"private-ranges-only"`).
 */
export type Egress = "all-traffic" | "private-ranges-only";

export const Egress: {
    readonly all: Egress;
    readonly private: Egress;
} = {
    all: "all-traffic",
    private: "private-ranges-only",
};

/**
 * Política de tráfico entrante de un servicio Cloud Run.
 *
 * - `all`      — permite todo el tráfico entrante, incluido el público (`"all"`).
 * - `internal` — solo tráfico interno y desde el load balancer (`"internal-and-cloud-load-balancing"`).
 */
export type Ingress = "all" | "internal-and-cloud-load-balancing";

export const Ingress: {
    readonly all: Ingress;
    readonly internal: Ingress;
} = {
    all: "all",
    internal: "internal-and-cloud-load-balancing",
};

/**
 * Configuración de red de un despliegue Cloud Run (`deploy.lambda` en `mrpack.json`).
 *
 * @property ingress - Política de tráfico entrante. Por defecto `"internal-and-cloud-load-balancing"`.
 * @property egress  - Política de tráfico saliente. Solo aplica cuando `vpc` es `true`.
 * @property vpc     - Si `true`, el servicio se conecta a la VPC del proyecto. Por defecto `false`.
 */
export interface IManifestDeploymentLambda {
    egress?: Egress;
    ingress: Ingress;
    vpc: boolean;
}

/**
 * Modelo de la sección `deploy.lambda` de `mrpack.json`.
 */
export class ManifestDeploymentLambda implements IManifestDeploymentLambda {
    /* STATIC */
    public static build(deploy: IManifestDeploymentLambda): ManifestDeploymentLambda {
        return new this(deploy);
    }

    /* INSTANCE */
    public egress?: Egress;
    public ingress: Ingress;
    public vpc: boolean;

    protected constructor(lambda: IManifestDeploymentLambda) {
        this.egress = lambda.egress;
        this.ingress = lambda.ingress;
        this.vpc = lambda.vpc;
    }

    public toJSON(): IManifestDeploymentLambda {
        return {
            egress: this.egress,
            ingress: this.ingress,
            vpc: this.vpc,
        };
    }
}
