import type {IManifestDeploymentCredenciales} from "@mr/cli/manifest/deployment/credenciales";

import {IManifestLegacy} from "../legacy";

export class ManifestWorkspaceDeploymentCredencialesLoader {
    /* STATIC */
    public static check(credenciales?: Partial<IManifestDeploymentCredenciales>[]): IManifestDeploymentCredenciales[]|undefined {
        if (credenciales==undefined) {
            return;
        }

        const salida: IManifestDeploymentCredenciales[] = [];
        for (const actual of credenciales) {
            if (actual.source!=undefined && actual.target!=undefined) {
                salida.push({
                    source: actual.source,
                    target: actual.target
                });
            }
        }

        if (salida.length==0) {
            return;
        }

        return salida;
    }

    public static fromLegacy(config: Partial<IManifestLegacy>): IManifestDeploymentCredenciales[]|undefined {
        if (config.credenciales==undefined || config.credenciales.length==0) {
            return undefined;
        }

        if (!Array.isArray(config.credenciales)) {
            config.credenciales = [config.credenciales];
        }
        const salida: IManifestDeploymentCredenciales[] = [];
        for (const credenciales of config.credenciales) {
            if (credenciales.source == undefined) {
                throw new Error(`ManifestDeploymentCredenciales: source no definido`);
            }
            if (credenciales.target == undefined) {
                throw new Error(`ManifestDeploymentCredenciales: target no definido`);
            }

            salida.push({
                source: credenciales.source,
                target: credenciales.target,
            });
        }

        return salida;
    }

    /* INSTANCE */
}
