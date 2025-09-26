import type {IManifestBuildDatabase} from "@mr/cli/manifest/build/database";

export class ManifestWorkspaceBuildDatabaseLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestBuildDatabase|undefined {
        return undefined;
    }

    public static check(imagen?: Partial<IManifestBuildDatabase>): IManifestBuildDatabase|undefined {
        if (imagen===undefined) {
            return this.DEFAULT;
        }
        const data = this.DEFAULT ?? {};
        if (imagen.produccion!=undefined) {
            data.produccion = imagen.produccion;
        }
        if (imagen.test!=undefined) {
            data.test = imagen.test;
        }

        return data;
    }

    /* INSTANCE */
}
