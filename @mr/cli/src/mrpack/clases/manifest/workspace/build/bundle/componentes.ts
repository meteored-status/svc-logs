import {type IManifestBuildComponentes, ManifestBuildComponentesCSS} from "@mr/cli/manifest/build/bundle/componentes";

import type {IManifestLegacyComponentes} from "../../legacy";

export class ManifestWorkspaceBuildComponentesLoader {
    /* STATIC */
    public static get DEFAULT(): Partial<IManifestBuildComponentes> {
        return {};
    }

    public static check(componentes?: Partial<IManifestBuildComponentes>): Partial<IManifestBuildComponentes>|undefined {
        if (componentes==undefined) {
            return;
        }

        const data = this.DEFAULT;
        if (componentes.optimizar!=undefined) {
            data.optimizar = componentes.optimizar;
        }
        if (componentes.pug!=undefined) {
            data.pug = componentes.pug;
        }
        if (componentes.css!=undefined) {
            data.css = componentes.css;
        }

        if (Object.keys(data).length==0) {
            return;
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacyComponentes>={}): Partial<IManifestBuildComponentes>|undefined {
        if (config.optimizar==undefined && config.pug==undefined && config.css==undefined && config.css_type==undefined) {
            return;
        }

        let css: ManifestBuildComponentesCSS;
        if (config.css==undefined || !config.css) {
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

    /* INSTANCE */
}
