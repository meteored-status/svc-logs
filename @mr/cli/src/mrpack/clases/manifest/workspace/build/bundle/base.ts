import type {IManifestBuildBundleBase,} from "@mr/cli/manifest/build/bundle/base";

import type {IManifestLegacyBundleBase} from "../../legacy";
import ManifestWorkspaceBuildComponentesLoader from "./componentes";

export class ManifestWorkspaceBuildBundleBaseLoader {
    /* INSTANCE */
    public get default(): IManifestBuildBundleBase {
        return {};
    }

    public check(bundle?: Partial<IManifestBuildBundleBase>): IManifestBuildBundleBase|undefined {
        if (!bundle) {
            return;
        }

        const data = this.default;
        if (bundle.componentes) {
            data.componentes = ManifestWorkspaceBuildComponentesLoader.check(bundle.componentes);
        }
        if (bundle.entries && Object.keys(bundle.entries).length>0) {
            data.entries = bundle.entries;
        }
        if (bundle.prefix) {
            data.prefix = bundle.prefix;
        }
        if (bundle.source_map && bundle.source_map.length>0) {
            data.source_map = bundle.source_map;
        }

        if (Object.keys(data).length===0) {
            return;
        }

        return data;
    }

    public fromLegacy(config: Partial<IManifestLegacyBundleBase>): IManifestBuildBundleBase|undefined {
        if (!config.source_map && !config.componentes && !config.entries && !config.prefix) {
            return;
        }

        let entries: Record<string, string>|undefined;
        if (config.entries && Object.keys(config.entries).length>0) {
            entries = config.entries;
        }
        let prefix: string|undefined;
        if (config.prefix && config.prefix.length>0) {
            prefix = config.prefix;
        }
        let sourceMap: string[]|undefined;
        if (config.source_map) {
            if (Array.isArray(config.source_map)) {
                sourceMap = config.source_map;
            } else {
                sourceMap = [config.source_map];
            }
        }

        return {
            componentes: ManifestWorkspaceBuildComponentesLoader.fromLegacy(config.componentes),
            entries,
            prefix,
            source_map: sourceMap,
        };
    }
}

export default new ManifestWorkspaceBuildBundleBaseLoader();
