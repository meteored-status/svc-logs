import type {IManifestBuildBundleBase,} from "@mr/cli/manifest/build/bundle/base";

import type {IManifestLegacyBundleBase} from "../../legacy";
import {ManifestWorkspaceBuildComponentesLoader} from "./componentes";

export class ManifestWorkspaceBuildBundleBaseLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestBuildBundleBase {
        return {};
    }

    public static check(bundle?: Partial<IManifestBuildBundleBase>): IManifestBuildBundleBase|undefined {
        if (bundle==undefined) {
            return;
        }

        const data = this.DEFAULT;
        if (bundle.componentes) {
            data.componentes = ManifestWorkspaceBuildComponentesLoader.check(bundle.componentes);
        }
        if (bundle.entries!=undefined && Object.keys(bundle.entries).length>0) {
            data.entries = bundle.entries;
        }
        if (bundle.prefix!=undefined) {
            data.prefix = bundle.prefix;
        }
        if (bundle.source_map!=undefined && bundle.source_map.length>0) {
            data.source_map = bundle.source_map;
        }

        if (Object.keys(data).length==0) {
            return;
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacyBundleBase>): IManifestBuildBundleBase|undefined {
        if (config.source_map==undefined && config.componentes==undefined && config.entries==undefined && config.prefix==undefined) {
            return;
        }

        let entries: Record<string, string>|undefined;
        if (config.entries!=undefined && Object.keys(config.entries).length>0) {
            entries = config.entries;
        }
        let prefix: string|undefined;
        if (config.prefix!=undefined && config.prefix.length>0) {
            prefix = config.prefix;
        }
        let source_map: string[]|undefined;
        if (config.source_map!=undefined) {
            if (Array.isArray(config.source_map)) {
                source_map = config.source_map;
            } else {
                source_map = [config.source_map];
            }
        }

        return {
            componentes: ManifestWorkspaceBuildComponentesLoader.fromLegacy(config.componentes),
            entries,
            prefix,
            source_map,
        };
    }

    /* INSTANCE */
}
