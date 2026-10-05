/**
 * Editor: Bixus
 * Fecha: Thu, 01 Oct 2026 12:17:35 GMT
 * Hash: dcaab3dc161d077343d07198066b3fd7
 * Versión: 2026.10.1+3-bixus
 * Anterior: 2026.5.27+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
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
 * @property authentication - Si `false`, el servicio no exige autenticación para invocarlo («Allow public
 *                            access»): se desactiva la comprobación de IAM del invocador. Por defecto `true`.
 *                            Solo aplica a servicios, no a jobs.
 * @property ingress        - Política de tráfico entrante. Por defecto `"internal-and-cloud-load-balancing"`.
 * @property egress         - Política de tráfico saliente. Solo aplica cuando `vpc` es `true`.
 * @property vpc            - Si `true`, el servicio se conecta a la VPC del proyecto. Por defecto `false`.
 */
export interface IManifestDeploymentLambda {
    authentication?: boolean;
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
    public authentication?: boolean;
    public egress?: Egress;
    public ingress: Ingress;
    public vpc: boolean;

    protected constructor(lambda: IManifestDeploymentLambda) {
        this.authentication = lambda.authentication;
        this.egress = lambda.egress;
        this.ingress = lambda.ingress;
        this.vpc = lambda.vpc;
    }

    public toJSON(): IManifestDeploymentLambda {
        return {
            authentication: this.authentication,
            egress: this.egress,
            ingress: this.ingress,
            vpc: this.vpc,
        };
    }
}
