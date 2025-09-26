import {BuildFW, type IManifestBuild} from "@mr/cli/manifest/build";
import {IManifestBuildDatabase} from "@mr/cli/manifest/build/database";

import {ManifestWorkspaceBuildBundleLoader} from "./bundle";
import {BuildFWLegacy, type IManifestBuildLegacy, type IManifestLegacy} from "../legacy";
import {ManifestWorkspaceBuildDatabaseLoader} from "./database";

export class ManifestWorkspaceBuildLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestBuild {
        return {
            deps: [],
            database: ManifestWorkspaceBuildDatabaseLoader.DEFAULT,
            framework: BuildFW.meteored,
        };
    }

    public static check(build: Partial<IManifestBuild|IManifestBuildLegacy>={}): IManifestBuild {
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
            if (typeof build.database == "string") {
                data.database = ManifestWorkspaceBuildDatabaseLoader.check({
                    produccion: build.database,
                    test: build.database,
                });
            } else {
                data.database = ManifestWorkspaceBuildDatabaseLoader.check(build.database);
            }
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
        let database: IManifestBuildDatabase|undefined;
        if (config.database) {
            database = {
                produccion: config.database,
                test: config.database,
            };
        }

        return {
            deps,
            framework,
            database,
            bundle: ManifestWorkspaceBuildBundleLoader.fromLegacy(config.bundle),
        };
    }

    /* INSTANCE */
}
