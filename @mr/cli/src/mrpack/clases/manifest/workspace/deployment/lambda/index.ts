import {Egress, Ingress, IManifestDeploymentLambda} from "@mr/core-dev/manifest/deployment/lambda";

class ManifestWorkspaceDeploymentLambdaLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentLambda {
        return {
            ingress: Ingress.internal,
        };
    }

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

        return data;
    }
}

export default new ManifestWorkspaceDeploymentLambdaLoader();
