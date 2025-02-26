import {BuildFW, type IManifestBuild} from "@mr/cli/manifest/build";

import {ManifestWorkspaceBuildBundleLoader} from "./bundle";
import {BuildFWLegacy, type IManifestLegacy} from "../legacy";

export class ManifestWorkspaceBuildLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestBuild {
        return {
            deps: [],
            framework: BuildFW.meteored,
        };
    }

    public static check(build: Partial<IManifestBuild>={}): IManifestBuild {
        const data = this.DEFAULT;
        if (build.deps) {
            if (Array.isArray(build.deps)) {
                data.deps = build.deps;
            } else {
                data.deps = [build.deps];
            }
        }
        if (build.framework) {
            data.framework = build.framework;
        }
        if (build.database) {
            data.database = build.database;
        }
        if (build.bundle) {
            data.bundle = ManifestWorkspaceBuildBundleLoader.check(build.bundle);
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacy>): IManifestBuild {
        let deps: string[]|undefined;
        if (config.deps!=undefined && config.deps.length>0) {
            deps = config.deps;
        }
        let framework: BuildFW;
        switch (config.framework) {
            case BuildFWLegacy.nextjs:
                framework = BuildFW.nextjs;
                break;
            case BuildFWLegacy.meteored:
            default:
                framework = BuildFW.meteored;
                break;
        }

        return {
            deps,
            framework,
            database: config.database,
            bundle: ManifestWorkspaceBuildBundleLoader.fromLegacy(config.bundle),
        };
    }

    /* INSTANCE */
}
