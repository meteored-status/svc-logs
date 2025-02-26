export interface IManifestLegacyStorage {
    buckets: string[];
    package?: string;
    subdir?: string;
    subdir2?: string;
}

export const enum RuntimeLegacy {
    node = "node",
    browser = "browser",
    cfworker = "cfworker",
    php = "php",
}

export const enum BuildFWLegacy {
    meteored = "meteored",
    nextjs = "nextjs",
    // astro = "astro",
}

export interface IManifestLegacyCredenciales {
    source: string;
    target: string;
}

export interface IManifestLegacyComponentes {
    optimizar: boolean;
    pug: boolean;
    css: boolean;
    css_type: 0|1|2; // 0=inyectado por JS | 1=archivo independiente | 2=critical
}

export interface IManifestLegacyBundleBase {
    componentes?: Partial<IManifestLegacyComponentes>;
    entries?: Record<string, string>;
    prefix?: string;
    source_map?: string[];
}

export interface IManifestLegacyBundle extends IManifestLegacyBundleBase {
    web?: IManifestLegacyBundleBase|IManifestLegacyBundleBase[];
}

export interface IManifestLegacy {
    cronjob: boolean;
    devel: boolean;
    deploy: boolean;
    generar: boolean;
    imagen?: string;
    unico: boolean;
    deps: string[];
    storage?: IManifestLegacyStorage;
    runtime: RuntimeLegacy;
    framework: BuildFWLegacy;
    kustomize: string;
    credenciales: IManifestLegacyCredenciales[];
    database?: string;
    bundle: IManifestLegacyBundle;
}
