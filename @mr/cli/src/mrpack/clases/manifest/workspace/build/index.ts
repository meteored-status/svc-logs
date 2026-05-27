/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 5233214acbdcd5e6fb05e8b1d7ba39c4
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {BuildFW, type IManifestBuild} from "@mr/core-dev/manifest/build";
import {IManifestBuildDatabase} from "@mr/core-dev/manifest/build/database";

import ManifestWorkspaceBuildBundleLoader from "./bundle";
import {BuildFWLegacy, type IManifestBuildLegacy, type IManifestLegacy} from "../legacy";
import ManifestWorkspaceBuildDatabaseLoader from "./database";

class ManifestWorkspaceBuildLoader {
    /* INSTANCE */
    public get default(): IManifestBuild {
        return {
            deps: [],
            database: ManifestWorkspaceBuildDatabaseLoader.default,
            framework: BuildFW.meteored,
        };
    }

    /**
     * Normaliza y valida la sección `build` del workspace.
     *
     * @param build - Datos parciales de la sección `build` (acepta formato actual y legacy).
     * @returns Configuración de build completa y normalizada.
     */
    public check(build: Partial<IManifestBuild|IManifestBuildLegacy>={}): IManifestBuild {
        const data = this.default;
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

    /**
     * Migra la sección `build` desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Configuración de build migrada al formato actual.
     */
    public fromLegacy(config: Partial<IManifestLegacy>): IManifestBuild {
        let deps: string[]|undefined;
        if (config.deps && config.deps.length>0) {
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
}

export default new ManifestWorkspaceBuildLoader();
