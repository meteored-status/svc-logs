import type {IManifestBuildBundle} from "@mr/cli/manifest/build/bundle";
import type {IManifestBuildBundleBase} from "@mr/cli/manifest/build/bundle/base";

import type {IManifestLegacyBundle} from "../../legacy";
import {ManifestWorkspaceBuildBundleBaseLoader} from "./base";

class ManifestWorkspaceBuildBundleLoader extends ManifestWorkspaceBuildBundleBaseLoader {
    /* INSTANCE */
    public override get default(): IManifestBuildBundle {
        return {
            ...super.default,
        };
    }

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
