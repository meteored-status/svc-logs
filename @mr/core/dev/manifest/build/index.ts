/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 01 Jul 2026 07:11:52 GMT
 * Hash: 6823ca9d18e24de28637f97c9e2ca150
 * Versión: 2026.7.1+1-josantoniojimnez
 * Anterior: 2026.5.21+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/tiempo-web-estaticos.git
 */

import {type IManifestBuildBundle, ManifestBuildBundle} from "./bundle/index.ts";
import {type IManifestBuildDatabase, ManifestBuildDatabase} from "./database.ts";

/**
 * Framework de compilación del workspace.
 * Determina qué herramienta usa `mrpack` para generar el bundle de producción.
 *
 * - `meteored` — framework propio Meteored (rspack).
 * - `nextjs` — Next.js.
 */
export type BuildFW = "meteored" | "nextjs";

export const BuildFW: {
    readonly meteored: BuildFW;
    readonly nextjs: BuildFW;
    // readonly astro: BuildFW;
} = {
    meteored: "meteored",
    nextjs: "nextjs",
    // astro: "astro",
};

/**
 * Bundler de compilación del workspace.
 *
 * - `rspack` — bundler rspack de `@mr/core-dev`.
 * - `esbuild` — bundler esbuild.
 * - `none` — sin fase de bundling.
 */
export type BuildBundler = "rspack" | "esbuild" | "none";

export const BuildBundler: {
    readonly rspack: BuildBundler;
    readonly esbuild: BuildBundler;
    readonly none: BuildBundler;
} = {
    rspack: "rspack",
    esbuild: "esbuild",
    none: "none",
};

/**
 * Configuración de compilación de un workspace (`build` en `mrpack.json`).
 *
 * @property framework - Framework de compilación ({@link BuildFW}).
 * @property bundler - Bundler efectivo de compilación ({@link BuildBundler}).
 * @property deps - Workspaces del monorepo requeridos en tiempo de build. Por defecto `[]`.
 * @property database - Nombre de la BD MySQL por entorno. Omitir si el workspace no usa BD.
 * @property bundle - Configuración del empaquetado de assets (entries, componentes, prefijos…).
 */
export interface IManifestBuild {
    deps?: string[];
    framework: BuildFW;
    bundler: BuildBundler;
    database?: IManifestBuildDatabase;
    bundle?: IManifestBuildBundle;
}

/**
 * Modelo de la sección `build` de `mrpack.json`.
 */
export class ManifestBuild implements IManifestBuild {
    /* STATIC */
    public static build(build: IManifestBuild): ManifestBuild {
        return new this(build);
    }

    /* INSTANCE */
    public bundler: BuildBundler;
    public deps: string[];
    public framework: BuildFW;
    public database?: ManifestBuildDatabase;
    public bundle: ManifestBuildBundle;

    protected constructor(build: IManifestBuild) {
        this.bundler = build.bundler;
        this.deps = build.deps ?? [];
        this.framework = build.framework;
        this.database = ManifestBuildDatabase.build(build.database);
        this.bundle = ManifestBuildBundle.build(build.bundle);
    }

    public toJSON(): IManifestBuild {
        return {
            bundler: this.bundler,
            deps: this.deps.length>0 ? this.deps : undefined,
            framework: this.framework,
            database: this.database?.toJSON(),
            bundle: this.bundle?.toJSON(),
        };
    }
}
