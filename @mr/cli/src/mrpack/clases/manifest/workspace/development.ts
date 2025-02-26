import type {IManifestDevelopment} from "@mr/cli/manifest/development";

import type {IManifestLegacy} from "./legacy";

export class ManifestWorkspaceDevelopmentLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDevelopment {
        return {
            enabled: true,
        };
    }

    public static check(devel: Partial<IManifestDevelopment>={}): IManifestDevelopment {
        const data = this.DEFAULT;
        if (devel.enabled!=undefined) {
            data.enabled = devel.enabled;
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacy>): IManifestDevelopment {
        return {
            enabled: config.devel ?? true,
        };
    }

    /* INSTANCE */
}
