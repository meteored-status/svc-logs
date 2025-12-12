import type {IManifestDeploymentCredenciales} from "@mr/cli/manifest/deployment/credenciales";

import type {IManifestLegacy} from "../legacy";

class ManifestWorkspaceDeploymentCredencialesLoader {
    /* INSTANCE */
    public check(credenciales?: Partial<IManifestDeploymentCredenciales>[]): IManifestDeploymentCredenciales[]|undefined {
        if (!credenciales) {
            return;
        }

        const salida: IManifestDeploymentCredenciales[] = [];
        for (const actual of credenciales) {
            if (actual.source && actual.target) {
                salida.push({
                    source: actual.source,
                    target: actual.target
                });
            }
        }

        if (salida.length===0) {
            return;
        }

        return salida;
    }

    public fromLegacy(config: Partial<IManifestLegacy>): IManifestDeploymentCredenciales[]|undefined {
        if (!config.credenciales || config.credenciales.length===0) {
            return undefined;
        }

        if (!Array.isArray(config.credenciales)) {
            config.credenciales = [config.credenciales];
        }
        const salida: IManifestDeploymentCredenciales[] = [];
        for (const credenciales of config.credenciales) {
            if (!credenciales.source) {
                throw new Error(`ManifestDeploymentCredenciales: source no definido`);
            }
            if (!credenciales.target) {
                throw new Error(`ManifestDeploymentCredenciales: target no definido`);
            }

            salida.push({
                source: credenciales.source,
                target: credenciales.target,
            });
        }

        return salida;
    }
}

export default new ManifestWorkspaceDeploymentCredencialesLoader();
