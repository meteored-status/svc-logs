import {type IManifestDeployment, ManifestDeploymentKind, Runtime} from "@mr/cli/manifest/deployment";
import type {IManifestDeploymentCredenciales} from "@mr/cli/manifest/deployment/credenciales";
import type {IManifestDeploymentImagen} from "@mr/cli/manifest/deployment/imagen";
import type {IManifestDeploymentKustomize} from "@mr/cli/manifest/deployment/kustomize";
import type {IManifestDeploymentStorage} from "@mr/cli/manifest/deployment/storage";

import {ManifestWorkspaceDeploymentCredencialesLoader} from "./credenciales";
import {ManifestWorkspaceDeploymentImagenLoader} from "./imagen";
import {ManifestWorkspaceDeploymentKustomizeLoader} from "./kustomize";
import {ManifestWorkspaceDeploymentStorageLoader} from "./storage";
import {IManifestDeploymentLegacy, type IManifestLegacy, RuntimeLegacy} from "../legacy";

type IManifestDeploymentUpdate = IManifestDeployment | Exclude<IManifestDeployment, "kustomize"> & {
    kustomize?: string;
}

export class ManifestWorkspaceDeploymentLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeployment {
        return {
            enabled: true,
            type: ManifestDeploymentKind.SERVICE,
            imagen: ManifestWorkspaceDeploymentImagenLoader.DEFAULT,
            runtime: Runtime.node,
            kustomize: [],//ManifestWorkspaceDeploymentKustomizeLoader.DEFAULT,
        };
    }

    public static check(deploy: Partial<IManifestDeploymentUpdate|IManifestDeploymentLegacy> = {}, names: string[]): IManifestDeployment {
        const data = this.DEFAULT;
        if (deploy.enabled!=undefined) {
            data.enabled = deploy.enabled;
        }
        if (deploy.type!=undefined) {
            data.type = deploy.type;
        }
        if (deploy.runtime) {
            data.runtime = deploy.runtime;
        }

        switch(data.type) {
            case ManifestDeploymentKind.SERVICE:
            case ManifestDeploymentKind.CRONJOB:
            case ManifestDeploymentKind.JOB:
                data.alone = deploy.alone ?? false;
                if ("arch" in deploy) {
                    data.arch = deploy.arch;
                } else {
                    data.arch = [
                        "linux/amd64",
                        "linux/arm64",
                    ];
                }
                data.credenciales = ManifestWorkspaceDeploymentCredencialesLoader.check(deploy.credenciales);
                if (deploy.imagen==undefined) {
                    data.imagen = ManifestWorkspaceDeploymentImagenLoader.check(deploy.imagen, names.at(0));
                } else if (typeof deploy.imagen == "string") {
                    data.imagen = ManifestWorkspaceDeploymentImagenLoader.check({
                        produccion: deploy.imagen,
                        test: deploy.imagen,
                    }, names.at(0));
                } else {
                    data.imagen = ManifestWorkspaceDeploymentImagenLoader.check(deploy.imagen, names.at(0));
                }
                if (typeof deploy.kustomize == "string") {
                    data.kustomize = names.map(name=>ManifestWorkspaceDeploymentKustomizeLoader.check({name, dir: deploy.kustomize as string}));
                } else if (Array.isArray(deploy.kustomize)) {
                    data.kustomize = deploy.kustomize.map(k=>ManifestWorkspaceDeploymentKustomizeLoader.check(k));
                } else if (deploy.kustomize!=undefined) {
                    data.kustomize = [];
                    for (const name of names) {
                        data.kustomize.push(ManifestWorkspaceDeploymentKustomizeLoader.check({
                            ...deploy.kustomize,
                            name,
                        }));
                    }
                }
                break;
            case ManifestDeploymentKind.BROWSER:
                if (deploy.storage==undefined) {
                    throw new Error(`ManifestDeployment: deploy.storage no definido para "${data.type}"`);
                }
                data.storage = ManifestWorkspaceDeploymentStorageLoader.check(deploy.storage);
                break
            case ManifestDeploymentKind.WORKER:
                break;
        }

        return data;
    }

    public static fromLegacy(config: Partial<IManifestLegacy>, names: string[]): IManifestDeployment {
        let type: ManifestDeploymentKind;
        let alone: boolean|undefined;
        let arch: string[]|undefined;
        let credenciales: IManifestDeploymentCredenciales[]|undefined;
        let imagen: IManifestDeploymentImagen|undefined;
        let kustomize: IManifestDeploymentKustomize[] | undefined;
        let storage: IManifestDeploymentStorage|undefined;

        const cronjob = config.cronjob ?? false;
        if (cronjob) {
            type = ManifestDeploymentKind.CRONJOB;
            alone = config.unico ?? false;
            arch = [
                "linux/amd64",
                "linux/arm64",
            ];
            credenciales = ManifestWorkspaceDeploymentCredencialesLoader.fromLegacy(config);
            imagen = {
                produccion: config.imagen ? {
                    paquete: config.imagen,
                    nombre: names.at(0) ?? "defecto",
                } : {
                    paquete: "services",
                    nombre: names.at(0) ?? "defecto",
                },
                test: config.imagen ? {
                    paquete: config.imagen,
                    nombre: names.at(0) ?? "defecto",
                } : {
                    paquete: "services",
                    nombre: names.at(0) ?? "defecto",
                },
            };
            kustomize = names.map(name=>ManifestWorkspaceDeploymentKustomizeLoader.fromLegacy(config, name));
        } else {
            switch(config.runtime) {
                case RuntimeLegacy.node:
                case RuntimeLegacy.php:
                    type = ManifestDeploymentKind.SERVICE;
                    alone = config.unico ?? false;
                    arch = [
                        "linux/amd64",
                        "linux/arm64",
                    ];
                    imagen = {
                        produccion: config.imagen ? {
                            paquete: config.imagen,
                            nombre: names.at(0) ?? "defecto",
                        } : {
                            paquete: "services",
                            nombre: names.at(0) ?? "defecto",
                        },
                        test: config.imagen ? {
                            paquete: config.imagen,
                            nombre: names.at(0) ?? "defecto",
                        } : {
                            paquete: "services",
                            nombre: names.at(0) ?? "defecto",
                        },
                    };
                    credenciales = ManifestWorkspaceDeploymentCredencialesLoader.fromLegacy(config);
                    kustomize = names.map(name=>ManifestWorkspaceDeploymentKustomizeLoader.fromLegacy(config, name));
                    break;
                case RuntimeLegacy.browser:
                    type = ManifestDeploymentKind.BROWSER;
                    storage = ManifestWorkspaceDeploymentStorageLoader.fromLegacy(config);
                    break;
                case RuntimeLegacy.cfworker:
                    type = ManifestDeploymentKind.WORKER;
                    break;
                default:
                    throw new Error(`ManifestDeployment: framework no soportado "${config.framework}"`);
            }
        }
        let runtime: Runtime;
        switch(config.runtime) {
            case RuntimeLegacy.browser:
                runtime = Runtime.browser;
                break;
            case RuntimeLegacy.cfworker:
                runtime = Runtime.cfworker;
                break;
            case RuntimeLegacy.php:
                runtime = Runtime.php;
                break;
            case RuntimeLegacy.node:
            default:
                runtime = Runtime.node;
                break;
        }

        return {
            enabled: config.deploy ?? true,
            type,
            runtime,
            alone,
            arch,
            credenciales,
            imagen,
            kustomize,
            storage,
        };
    }

    /* INSTANCE */
}
