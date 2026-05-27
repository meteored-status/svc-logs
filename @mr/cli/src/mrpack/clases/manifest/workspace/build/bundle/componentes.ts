/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 67ff9037de6706d47a7371025ab8bd3d
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {type IManifestBuildComponentes, ManifestBuildComponentesCSS} from "@mr/core-dev/manifest/build/bundle/componentes";

import type {IManifestLegacyComponentes} from "../../legacy";

class ManifestWorkspaceBuildComponentesLoader {
    /* INSTANCE */
    public get default(): Partial<IManifestBuildComponentes> {
        return {};
    }

    /**
     * Normaliza y valida la configuración de componentes del bundle.
     *
     * @param componentes - Datos parciales de la configuración de componentes.
     * @returns Configuración de componentes normalizada, o `undefined` si el objeto resultante está vacío.
     */
    public check(componentes?: Partial<IManifestBuildComponentes>): Partial<IManifestBuildComponentes>|undefined {
        if (!componentes) {
            return;
        }

        const data = this.default;
        if (componentes.optimizar!==undefined) {
            data.optimizar = componentes.optimizar;
        }
        if (componentes.pug!==undefined) {
            data.pug = componentes.pug;
        }
        if (componentes.css!==undefined) {
            data.css = componentes.css;
        }

        if (Object.keys(data).length===0) {
            return;
        }

        return data;
    }

    /**
     * Migra la configuración de componentes desde el formato legacy.
     *
     * @param config - Datos en formato legacy a migrar.
     * @returns Configuración de componentes migrada, o `undefined` si no hay datos relevantes.
     */
    public fromLegacy(config: Partial<IManifestLegacyComponentes>={}): Partial<IManifestBuildComponentes>|undefined {
        if (!config.optimizar && !config.pug && !config.css && !config.css_type) {
            return;
        }

        let css: ManifestBuildComponentesCSS;
        if (!config.css) {
            css = ManifestBuildComponentesCSS.DESACTIVADO;
        } else {
            switch (config.css_type) {
                case 1:
                    css = ManifestBuildComponentesCSS.INDEPENDIENTE;
                    break;
                case 2:
                    css = ManifestBuildComponentesCSS.CRITICAL;
                    break;
                case 0:
                default:
                    css = ManifestBuildComponentesCSS.INYECTADO;
                    break;
            }
        }

        return {
            optimizar: config.optimizar,
            pug: config.pug,
            css,
        };
    }

}

export default new ManifestWorkspaceBuildComponentesLoader();
