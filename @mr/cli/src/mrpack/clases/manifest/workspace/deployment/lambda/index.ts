/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 11:12:48 GMT
 * Hash: 174a9cb2f8746777b16bda6480ac1b06
 * Versión: 2026.5.27+2-josantoniojimnez
 */

import {Egress, Ingress, IManifestDeploymentLambda} from "@mr/core-dev/manifest/deployment/lambda";

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

        if (lambda.egress) {
            if (lambda.egress===Egress.all || lambda.egress===Egress.private) {
                data.egress = lambda.egress;
            }
        }
        if (lambda.ingress) {
            if (lambda.ingress===Ingress.all || lambda.ingress===Ingress.internal) {
                data.ingress = lambda.ingress;
            }
        }
        data.vpc = lambda.vpc ?? false;

        return data;
    }
}

export default new ManifestWorkspaceDeploymentLambdaLoader();
