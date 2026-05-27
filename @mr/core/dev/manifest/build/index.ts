/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: c3a7bf0b4750ad7f74da1888fc9c9c32
 * Versión: 2026.5.21+1-josantoniojimnez
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
 * Configuración de compilación de un workspace (`build` en `mrpack.json`).
 *
 * @property framework - Framework de compilación ({@link BuildFW}).
 * @property deps - Workspaces del monorepo requeridos en tiempo de build. Por defecto `[]`.
 * @property database - Nombre de la BD MySQL por entorno. Omitir si el workspace no usa BD.
 * @property bundle - Configuración del empaquetado de assets (entries, componentes, prefijos…).
 */
export interface IManifestBuild {
    deps?: string[];
    framework: BuildFW;
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
    public deps: string[];
    public framework: BuildFW;
    public database?: ManifestBuildDatabase;
    public bundle: ManifestBuildBundle;

    protected constructor(build: IManifestBuild) {
        this.deps = build.deps ?? [];
        this.framework = build.framework;
        this.database = ManifestBuildDatabase.build(build.database);
        this.bundle = ManifestBuildBundle.build(build.bundle);
    }

    public toJSON(): IManifestBuild {
        return {
            deps: this.deps.length>0 ? this.deps : undefined,
            framework: this.framework,
            database: this.database?.toJSON(),
            bundle: this.bundle?.toJSON(),
        };
    }
}
