/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: a0315184894018ecb8a54ebc756aab0c
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentCredenciales} from "@mr/core-dev/manifest/deployment/credenciales";

import type {IManifestLegacy} from "../legacy";

class ManifestWorkspaceDeploymentCredencialesLoader {
    /* INSTANCE */
    /**
     * Valida y normaliza un array de credenciales parciales.
     *
     * @param credenciales - Array de objetos con `source` y `target` opcionales.
     * @returns Array de credenciales completas, o `undefined` si la entrada está vacía o es inválida.
     */
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

    /**
     * Migra la configuración de credenciales desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Array de credenciales migradas, o `undefined` si no hay datos.
     */
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
