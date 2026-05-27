/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 8460b9643a523d00bc49ceda578d908c
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import "dotenv/config";

import {type IManifest, Manifest} from "../../../../../manifest";

import {ManifestLoader} from "..";
import ManifestRootDeploymentLoader from "./deploy";

/**
 * Cargador del manifest raíz (`mrpack.json` en la raíz del monorepo).
 * Gestiona las opciones de compilación y despliegue globales del proyecto.
 */
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

    /**
     * Normaliza y valida el manifest raíz, completando con los defaults de despliegue.
     *
     * @param manifest - Datos parciales leídos del `mrpack.json` raíz.
     * @returns Objeto de manifest raíz completo y normalizado.
     */
    public check(manifest?: Partial<IManifest>): IManifest {
        const data = this.defecto.default;
        if (manifest?.deploy) {
            data.deploy = ManifestRootDeploymentLoader.check(manifest.deploy);
        }

        return data;
    }

    /**
     * Carga el manifest raíz desde disco de forma asíncrona.
     *
     * @param env - Si `true`, aplica las variables de entorno al manifest tras cargarlo.
     * @returns Promesa que resuelve con la propia instancia del loader.
     */
    public override async load(env?: boolean): Promise<ManifestRootLoader> {
        return await super.load(env) as ManifestRootLoader;
    }

    /**
     * Carga el manifest raíz desde disco de forma síncrona.
     *
     * @returns La propia instancia del loader para encadenar llamadas.
     */
    public override loadSync(): ManifestRootLoader {
        return super.loadSync() as ManifestRootLoader;
    }

    /**
     * Aplica variables de entorno (`_GENERAR`, `_DESPLEGAR`, etc.) sobre el manifest cargado.
     *
     * @returns La propia instancia del loader para encadenar llamadas.
     */
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
