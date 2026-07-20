/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 20 Jul 2026 07:17:20 GMT
 * Hash: f762221fa9032667629bd908bc9ddd5c
 * Versión: 2026.7.20+2-josantoniojimnez
 * Anterior: 2026.7.3+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-cmp.git
 */

import {BuildBundler, BuildFW, type IManifestBuild} from "@mr/core-dev/manifest/build";
import type {IManifestBuildBundle} from "@mr/core-dev/manifest/build/bundle";
import type {IManifestBuildBundleBase} from "@mr/core-dev/manifest/build/bundle/base";
import type {IManifestBuildDatabase} from "@mr/core-dev/manifest/build/database";
import type {Runtime} from "@mr/core-dev/manifest/deployment";

import ManifestWorkspaceBuildBundleLoader from "./bundle";
import {BuildFWLegacy, type IManifestBuildLegacy, type IManifestLegacy} from "../legacy";
import ManifestWorkspaceBuildDatabaseLoader from "./database";

interface IBuildLoaderConfig {
    runtime?: Runtime;
    dependencies?: Record<string, string>;
}

class ManifestWorkspaceBuildLoader {
    /* INSTANCE */
    public get default(): IManifestBuild {
        return {
            bundler: BuildBundler.esbuild,
            deps: [],
            database: ManifestWorkspaceBuildDatabaseLoader.default,
            framework: BuildFW.meteored,
        };
    }

    private getBundler(framework?: BuildFW, runtime?: Runtime, bundle?: IManifestBuildBundle, dependencies?: Record<string, string>): BuildBundler {
        switch (runtime) {
            case "browser":
                return BuildBundler.rspack;
            case "cfworker":
            case "php":
                return BuildBundler.none;
            case "node":
            default:
                if (framework===BuildFW.nextjs) {
                    return BuildBundler.none;
                }
                if (this.bundleRequiereRspack(bundle)) {
                    return BuildBundler.rspack;
                }
                return this.forceBundlerReflectMetadata(BuildBundler.esbuild, dependencies);
        }
    }

    /**
     * Normaliza `bundle.web` (objeto único o array, o ausente) a un array.
     *
     * @param bundle - Configuración de bundle sin normalizar (formato manifest).
     * @returns Array de bundles web adicionales, vacío si no hay ninguno.
     */
    private bundleWeb(bundle?: IManifestBuildBundle): IManifestBuildBundleBase[] {
        if (bundle?.web==undefined) {
            return [];
        }
        return Array.isArray(bundle.web) ? bundle.web : [bundle.web];
    }

    /**
     * Determina si el bundle requiere `rspack`: porque el bundle principal declara un pipeline
     * de `componentes` no vacío, o porque hay algún bundle web adicional (`bundle.web[]`) —
     * esbuild no soporta ninguno de los dos casos.
     *
     * @param bundle - Configuración de bundle sin normalizar (formato manifest, `web` puede ser
     *   un objeto único o un array).
     * @returns `true` si el bundle principal tiene `componentes`, o si `web[]` tiene alguna entrada.
     */
    private bundleRequiereRspack(bundle?: IManifestBuildBundle): boolean {
        if (bundle==undefined) {
            return false;
        }
        if (bundle.componentes!=undefined && Object.keys(bundle.componentes).length>0) {
            return true;
        }
        return this.bundleWeb(bundle).length>0;
    }

    /**
     * Fuerza `rspack` cuando el bundler resultante es `esbuild` pero el workspace depende de
     * `reflect-metadata`, ya que esbuild no emite `decoratorMetadata` y esa dependencia dejaría
     * de funcionar en tiempo de ejecución. Se aplica también sobre valores explícitos del
     * manifest, ya que `esbuild` + `reflect-metadata` nunca es una combinación válida.
     *
     * @param bundler - Bundler calculado o informado explícitamente en el manifest.
     * @param dependencies - Dependencias del `package.json` del workspace.
     * @returns El bundler corregido, o el mismo si no aplica la restricción.
     */
    private forceBundlerReflectMetadata(bundler: BuildBundler, dependencies?: Record<string, string>): BuildBundler {
        if (bundler===BuildBundler.esbuild && dependencies?.["reflect-metadata"]!=undefined) {
            return BuildBundler.rspack;
        }
        return bundler;
    }

    /**
     * Fuerza `rspack` cuando el bundler resultante es `esbuild` pero el workspace declara algún
     * bundle web adicional (`bundle.web[]`), ya que esbuild no soporta `bundle.web` en absoluto.
     * Se aplica también sobre valores explícitos del manifest, ya que `esbuild` + `bundle.web`
     * nunca es una combinación válida.
     *
     * @param bundler - Bundler calculado o informado explícitamente en el manifest.
     * @param bundle - Configuración de bundle sin normalizar (formato manifest).
     * @returns El bundler corregido, o el mismo si no aplica la restricción.
     */
    private forceBundlerBundleWeb(bundler: BuildBundler, bundle?: IManifestBuildBundle): BuildBundler {
        if (bundler===BuildBundler.esbuild && this.bundleWeb(bundle).length>0) {
            return BuildBundler.rspack;
        }
        return bundler;
    }

    /**
     * Normaliza y valida la sección `build` del workspace.
     *
     * @param build - Datos parciales de la sección `build` (acepta formato actual y legacy).
     * @param config - Contexto adicional del workspace (runtime) para derivar `build.bundler`.
     *
     * Si `build.bundler` viene informado en el manifest, se respeta ese valor, salvo que sea
     * `esbuild` y el workspace dependa de `reflect-metadata`, o declare algún `bundle.web[]`,
     * en cuyo caso se fuerza `rspack`. Si no viene, se deriva automáticamente con `getBundler()`.
     * @returns Configuración de build completa y normalizada.
     */
    public check(build: Partial<IManifestBuild|IManifestBuildLegacy>={}, config: IBuildLoaderConfig = {}): IManifestBuild {
        const {runtime, dependencies} = config;
        const data = this.default;
        const bundler = this.forceBundlerReflectMetadata(build.bundler ?? this.getBundler(build.framework, runtime, build.bundle, dependencies), dependencies);
        data.bundler = this.forceBundlerBundleWeb(bundler, build.bundle);
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
     * @param buildConfig - Contexto adicional del workspace (runtime) para derivar `build.bundler`.
     * @returns Configuración de build migrada al formato actual.
     */
    public fromLegacy(config: Partial<IManifestLegacy>, buildConfig: IBuildLoaderConfig = {}): IManifestBuild {
        const {runtime, dependencies} = buildConfig;
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
        const bundle = ManifestWorkspaceBuildBundleLoader.fromLegacy(config.bundle);

        return {
            deps,
            framework,
            bundler: this.getBundler(framework, runtime, bundle, dependencies),
            database,
            bundle,
        };
    }
}

export default new ManifestWorkspaceBuildLoader();
