import type {IManifestDeploymentKustomize} from "@mr/cli/manifest/deployment/kustomize";

import {type IManifestLegacy, RuntimeLegacy} from "../../legacy";

export class ManifestWorkspaceDeploymentKustomizeLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentKustomize {
        return {
            legacy:  "services",
        };
    }

    public static check(kustomize: Partial<IManifestDeploymentKustomize>={}): IManifestDeploymentKustomize {
        const data = this.DEFAULT;
        if (kustomize.legacy!=undefined) {
            data.legacy = kustomize.legacy;
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacy>): IManifestDeploymentKustomize {
        let legacy: string|undefined;

        const cronjob = config.cronjob ?? false;
        if (cronjob) {
            legacy = config.kustomize;
        } else {
            switch(config.runtime) {
                case RuntimeLegacy.node:
                case RuntimeLegacy.php:
                    legacy = config.kustomize;
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
            legacy,
        };
    }

    /* INSTANCE */
}
