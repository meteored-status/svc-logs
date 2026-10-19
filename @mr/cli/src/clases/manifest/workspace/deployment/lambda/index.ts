/**
 * Editor: Bixus
 * Fecha: Fri, 02 Oct 2026 06:53:09 GMT
 * Hash: 069d58f68f67e78d05aff4542e40f297
 * Versión: 2026.10.2+2-bixus
 * Anterior: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {Egress, Ingress, type IManifestDeploymentLambda, type IManifestDeploymentLambdaLabels} from "@mr/core-dev/manifest/deployment/lambda";

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
     * se copia tal cual, usando `false` si no está definida. `authentication`
     * se copia solo si es booleano; si no, se omite y vale lo de por defecto
     * (`true`), sin escribirlo en el `mrpack.json`. De `labels` se conservan
     * `dpto` y `producto` si son cadenas no vacías; si no queda ninguna, se omite
     * `labels` entero.
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
        if (typeof lambda.authentication === "boolean") {
            data.authentication = lambda.authentication;
        }
        const labels = this.checkLabels(lambda.labels);
        if (labels) {
            data.labels = labels;
        }

        if (data.vpc) {
            if (lambda.egress && (lambda.egress===Egress.all || lambda.egress===Egress.private)) {
                data.egress = lambda.egress;
            } else {
                data.egress = Egress.private;
            }
        }

        return data;
    }

    /**
     * Conserva de `deploy.lambda.labels` solo `dpto` y `producto`, y solo si son cadenas no vacías. El formato
     * de los valores no se valida aquí, sino al desplegar (`kustomizar.sh`), que también completa las que faltan
     * con las del proyecto de GCP.
     *
     * @param labels - Bloque `deploy.lambda.labels` del manifest.
     * @returns Labels válidas, o `undefined` si no queda ninguna.
     */
    private checkLabels(labels?: Partial<IManifestDeploymentLambdaLabels>): IManifestDeploymentLambdaLabels | undefined {
        if (!labels) {
            return undefined;
        }

        const data: IManifestDeploymentLambdaLabels = {};
        if (typeof labels.dpto === "string" && labels.dpto.length>0) {
            data.dpto = labels.dpto;
        }
        if (typeof labels.producto === "string" && labels.producto.length>0) {
            data.producto = labels.producto;
        }

        return Object.keys(data).length>0 ? data : undefined;
    }
}

export default new ManifestWorkspaceDeploymentLambdaLoader();
