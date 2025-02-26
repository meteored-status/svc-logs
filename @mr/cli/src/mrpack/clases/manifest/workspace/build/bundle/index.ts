import type {IManifestBuildBundle} from "@mr/cli/manifest/build/bundle";
import type {IManifestBuildBundleBase} from "@mr/cli/manifest/build/bundle/base";

import type {IManifestLegacyBundle} from "../../legacy";
import {ManifestWorkspaceBuildBundleBaseLoader} from "./base";

export class ManifestWorkspaceBuildBundleLoader extends ManifestWorkspaceBuildBundleBaseLoader {
    /* STATIC */
    public static override get DEFAULT(): IManifestBuildBundle {
        return {
            ...super.DEFAULT,
        };
    }

    public static override check(bundle?: Partial<IManifestBuildBundle>): IManifestBuildBundle|undefined {
        if (bundle==undefined) {
            return;
        }

        const data = {
            ...this.DEFAULT,
            ...super.check(bundle),
        };
        if (bundle.web!=undefined) {
            if (Array.isArray(bundle.web)) {
                data.web = bundle.web.map(actual=>ManifestWorkspaceBuildBundleBaseLoader.check(actual)).filter(actual=>actual!=undefined);
            } else {
                data.web = ManifestWorkspaceBuildBundleBaseLoader.check(bundle.web);
            }
        }

        if (Object.keys(data).length==0) {
            return;
        }

        return data;
    }

    public static override fromLegacy(config?: Partial<IManifestLegacyBundle>): IManifestBuildBundle|undefined {
        if (config==undefined || Object.keys(config).length==0) {
            return;
        }

        const web: IManifestBuildBundleBase[] = [];
        if (config.web!=undefined) {
            if (Array.isArray(config.web)) {
                web.push(...config.web.map(actual=>ManifestWorkspaceBuildBundleBaseLoader.fromLegacy(actual)).filter(actual=>actual!=undefined));
            } else {
                const actual = ManifestWorkspaceBuildBundleBaseLoader.fromLegacy(config.web);
                if (actual!=undefined) {
                    web.push(actual);
                }
            }
        }
        return {
            ...ManifestWorkspaceBuildBundleBaseLoader.fromLegacy(config ?? {}),
            web,
        }
    }

    /* INSTANCE */
}
