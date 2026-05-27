/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 875a091a62c9ed85b1c368ed51253965
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestBuildBundle} from "@mr/core-dev/manifest/build/bundle";
import type {IManifestBuildBundleBase} from "@mr/core-dev/manifest/build/bundle/base";

import type {IManifestLegacyBundle} from "../../legacy";
import {ManifestWorkspaceBuildBundleBaseLoader} from "./base";

class ManifestWorkspaceBuildBundleLoader extends ManifestWorkspaceBuildBundleBaseLoader {
    /* INSTANCE */
    public override get default(): IManifestBuildBundle {
        return {
            ...super.default,
        };
    }

    /**
     * Normaliza y valida la configuración completa de bundle (base + sección `web`).
     *
     * @param bundle - Datos parciales de la configuración de bundle.
     * @returns Configuración de bundle normalizada, o `undefined` si el objeto resultante está vacío.
     */
    public override check(bundle?: Partial<IManifestBuildBundle>): IManifestBuildBundle|undefined {
        if (!bundle) {
            return;
        }

        const data = {
            ...this.default,
            ...super.check(bundle),
        };
        if (bundle.web) {
            if (Array.isArray(bundle.web)) {
                data.web = bundle.web.map(actual=>super.check(actual)).filter(actual=>actual!=undefined);
            } else {
                data.web = super.check(bundle.web);
            }
        }

        if (Object.keys(data).length===0) {
            return;
        }

        return data;
    }

    /**
     * Migra la configuración de bundle desde el formato legacy, incluyendo entradas `web`.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Configuración de bundle migrada, o `undefined` si no hay datos relevantes.
     */
    public override fromLegacy(config?: Partial<IManifestLegacyBundle>): IManifestBuildBundle|undefined {
        if (!config || Object.keys(config).length===0) {
            return;
        }

        const web: IManifestBuildBundleBase[] = [];
        if (config.web) {
            if (Array.isArray(config.web)) {
                web.push(...config.web.map(actual=>super.fromLegacy(actual)).filter(actual=>actual!==undefined));
            } else {
                const actual = super.fromLegacy(config.web);
                if (actual) {
                    web.push(actual);
                }
            }
        }
        return {
            ...super.fromLegacy(config ?? {}),
            web,
        }
    }
}

export default new ManifestWorkspaceBuildBundleLoader();
