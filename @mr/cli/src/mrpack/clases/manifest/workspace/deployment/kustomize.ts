/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 0303b8083ea65711d23098e45b7d7dd3
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentKustomize} from "@mr/core-dev/manifest/deployment/kustomize";

import {type IManifestLegacy, RuntimeLegacy} from "../legacy";

class ManifestWorkspaceDeploymentKustomizeLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentKustomize {
        return {
            name: "",
            dir: "services",
        };
    }

    /**
     * Normaliza y valida la configuración de kustomize de un workspace.
     *
     * @param kustomize - Datos parciales de la configuración de kustomize.
     * @returns Configuración de kustomize completa y normalizada.
     */
    public check(kustomize: Partial<IManifestDeploymentKustomize> = {}): IManifestDeploymentKustomize {
        const data = this.default;
        if (kustomize.name) {
            data.name = kustomize.name;
        }
        if (kustomize.dir) {
            data.dir = kustomize.dir;
        }
        if (kustomize.credenciales) {
            data.credenciales = {};
            for (const key of Object.keys(kustomize.credenciales).sort()) {
                const value = kustomize.credenciales[key];
                if (typeof value !== "string") {
                    continue;
                }
                data.credenciales[key] = value;
            }
        }
        if (kustomize.ssl) {
            data.ssl = {};
            for (const key of Object.keys(kustomize.ssl).sort()) {
                const value = kustomize.ssl[key];
                if (typeof value !== "string") {
                    continue;
                }
                data.ssl[key] = value;
            }
        }

        return data;
    }

    /**
     * Migra la configuración de kustomize desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @param name   - Nombre del recurso kustomize.
     * @returns Configuración de kustomize migrada al formato actual.
     */
    public fromLegacy(config: Partial<IManifestLegacy>, name: string): IManifestDeploymentKustomize {
        let dir: string | undefined;

        const cronjob = config.cronjob ?? false;
        if (cronjob) {
            dir = config.kustomize;
        } else {
            switch (config.runtime) {
                case RuntimeLegacy.node:
                case RuntimeLegacy.php:
                    dir = config.kustomize;
                    break;
                case RuntimeLegacy.browser:
                    break;
                case RuntimeLegacy.cfworker:
                    break;
                default:
                    throw new Error(`ManifestDeployment: framework no soportado "${config.framework}"`);
            }
        }

        return {
            name,
            dir,
        };
    }
}

export default new ManifestWorkspaceDeploymentKustomizeLoader();
