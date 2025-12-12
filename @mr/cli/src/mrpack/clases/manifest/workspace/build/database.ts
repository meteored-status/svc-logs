import type {IManifestBuildDatabase} from "@mr/cli/manifest/build/database";

class ManifestWorkspaceBuildDatabaseLoader {
    /* INSTANCE */
    public get default(): IManifestBuildDatabase|undefined {
        return undefined;
    }

    public check(imagen?: Partial<IManifestBuildDatabase>): IManifestBuildDatabase|undefined {
        if (!imagen) {
            return this.default;
        }
        const data = this.default ?? {};
        if (imagen.produccion) {
            data.produccion = imagen.produccion;
        }
        if (imagen.test) {
            data.test = imagen.test;
        }

        return data;
    }
}

export default new ManifestWorkspaceBuildDatabaseLoader();
