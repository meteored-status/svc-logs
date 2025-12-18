import {type IManifestBuildComponentes, ManifestBuildComponentesCSS} from "@mr/cli/manifest/build/bundle/componentes";

import type {IManifestLegacyComponentes} from "../../legacy";

class ManifestWorkspaceBuildComponentesLoader {
    /* INSTANCE */
    public get default(): Partial<IManifestBuildComponentes> {
        return {};
    }

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
