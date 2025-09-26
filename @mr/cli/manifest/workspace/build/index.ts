import {type IManifestBuildBundle, ManifestBuildBundle} from "./bundle";
import {type IManifestBuildDatabase, ManifestBuildDatabase} from "./database";

export const enum BuildFW {
    meteored = "meteored",
    nextjs = "nextjs",
    // astro = "astro",
}

export interface IManifestBuild {
    deps?: string[]; // workspaces de los que depende el workspace actual
    framework: BuildFW;
    database?: IManifestBuildDatabase;
    bundle?: IManifestBuildBundle;
}

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
