import type {IManifestDevelopment} from "@mr/cli/manifest/development";

import type {IManifestLegacy} from "./legacy";

class ManifestWorkspaceDevelopmentLoader {
    /* INSTANCE */
    public get default(): IManifestDevelopment {
        return {
            enabled: true,
        };
    }

    public check(devel: Partial<IManifestDevelopment>={}): IManifestDevelopment {
        const data = this.default;
        if (devel.enabled) {
            data.enabled = devel.enabled;
        }

        return data;
    }

    public fromLegacy(config: Partial<IManifestLegacy>): IManifestDevelopment {
        return {
            enabled: config.devel ?? true,
        };
    }
}

export default new ManifestWorkspaceDevelopmentLoader();
