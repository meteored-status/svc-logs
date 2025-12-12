import "dotenv/config";

import {type IManifest, Manifest} from "../../../../../manifest/root";

import {ManifestLoader} from "..";
import ManifestRootDeploymentLoader from "./deploy";

export class ManifestRootLoader extends ManifestLoader<IManifest, Manifest> {
    /* STATIC */
    public static get default(): IManifest {
        return {
            deploy: ManifestRootDeploymentLoader.default,
        };
    }

    /* INSTANCE */
    public constructor(basedir: string) {
        super(basedir, Manifest, ManifestRootLoader);
    }

    public check(manifest?: Partial<IManifest>): IManifest {
        const data = this.defecto.default;
        if (manifest?.deploy) {
            data.deploy = ManifestRootDeploymentLoader.check(manifest.deploy);
        }

        return data;
    }

    public override async load(env?: boolean): Promise<ManifestRootLoader> {
        return await super.load(env) as ManifestRootLoader;
    }

    public override loadSync(): ManifestRootLoader {
        return super.loadSync() as ManifestRootLoader;
    }

    public applyENV(): ManifestRootLoader {
        if (![undefined, ""].includes(process.env["_GENERAR"])) {
            this.manifest.deploy.build.enabled = process.env["_GENERAR"] !== "false" && process.env["_GENERAR"] !== "0";
        }
        if (![undefined, ""].includes(process.env["_GENERAR_FORZAR"])) {
            this.manifest.deploy.build.force = process.env["_GENERAR_FORZAR"] === "true" || process.env["_GENERAR_FORZAR"] === "1";
        }
        if (![undefined, ""].includes(process.env["_DESPLEGAR"])) {
            this.manifest.deploy.run.enabled = process.env["_DESPLEGAR"] !== "false" && process.env["_DESPLEGAR"] !== "0";
        }
        if (![undefined, ""].includes(process.env["_DESPLEGAR_LATEST"])) {
            this.manifest.deploy.run.latest = process.env["_DESPLEGAR_LATEST"] === "true" || process.env["_DESPLEGAR_LATEST"] === "1";
        }

        return this;
    }
}
