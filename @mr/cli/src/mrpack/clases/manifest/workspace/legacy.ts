import type {IManifestDeploymentCredenciales} from "../../../../../manifest/workspace/deployment/credenciales";
import type {IManifestDeploymentKustomize} from "../../../../../manifest/workspace/deployment/kustomize";
import type {IManifestDeploymentStorage} from "../../../../../manifest/workspace/deployment/storage";
import {ManifestDeploymentKind, Runtime} from "../../../../../manifest/workspace/deployment";
import type {IManifestBuildDatabase} from "../../../../../manifest/workspace/build/database";
import type {IManifestBuildBundle} from "../../../../../manifest/workspace/build/bundle";
import {BuildFW} from "../../../../../manifest/workspace/build";

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

export interface IManifestBuildLegacy {
    deps?: string[];
    framework: BuildFW;
    database?: string;
    bundle?: IManifestBuildBundle;
}

export interface IManifestDeploymentLegacy {
    enabled: boolean;
    type: ManifestDeploymentKind;
    runtime: Runtime;
    alone?: boolean;
    credenciales?: IManifestDeploymentCredenciales[];
    imagen?: string;
    kustomize?: IManifestDeploymentKustomize;
    storage?: IManifestDeploymentStorage;
}

export interface IManifestDeploymentStorageLegacy {
    buckets: string[];
    bundle: string;
    subdirPrefix: string;
    subdir?: string;
    subdirPostfix: string;
    previo?: string[]; // si cambiamos el directorio de los archivos, mantenemos los directorios anteriores para seguir teniendo acceso a los datos
}
