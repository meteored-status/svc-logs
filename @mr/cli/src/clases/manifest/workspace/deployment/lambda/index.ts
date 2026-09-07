/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 242fc0261988608453574ab767662423
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Egress, Ingress, type IManifestDeploymentLambda} from "@mr/core-dev/manifest/deployment/lambda";

/**
 * Normaliza la sección `deploy.lambda` del `mrpack.json` de un workspace.
 *
 * Aplica valores por defecto y valida que `egress` e `ingress` contengan
 * únicamente los literales permitidos por sus respectivos enums.
 */
class ManifestWorkspaceDeploymentLambdaLoader {
    /* INSTANCE */

    /**
     * Configuración de red mínima para un servicio Cloud Run:
     * solo tráfico interno y load balancer, sin VPC.
     */
    public get default(): IManifestDeploymentLambda {
        return {
            egress: undefined,
            ingress: Ingress.internal,
            vpc: false,
        };
    }

    /**
     * Valida y normaliza la sección `deploy.lambda` de un workspace.
     *
     * Los valores de `egress` e `ingress` que no pertenezcan al enum permitido
     * son ignorados y se conserva el valor por defecto. La propiedad `vpc`
     * se copia tal cual, usando `false` si no está definida.
     *
     * @param lambda - Bloque `deploy.lambda` parcial del manifest.
     * @returns Configuración `lambda` completa y validada.
     */
    public check(lambda?: Partial<IManifestDeploymentLambda>): IManifestDeploymentLambda {
        const data = this.default;
        if (!lambda) {
            return data;
        }

        if (lambda.ingress) {
            if (lambda.ingress===Ingress.all || lambda.ingress===Ingress.internal) {
                data.ingress = lambda.ingress;
            }
        }
        data.vpc = lambda.vpc ?? false;

        if (data.vpc) {
            if (lambda.egress && (lambda.egress===Egress.all || lambda.egress===Egress.private)) {
                data.egress = lambda.egress;
            } else {
                data.egress = Egress.private;
            }
        }

        return data;
    }
}

export default new ManifestWorkspaceDeploymentLambdaLoader();
