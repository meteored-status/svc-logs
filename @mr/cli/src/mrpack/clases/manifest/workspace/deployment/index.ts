/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 11:38:09 GMT
 * Hash: c231c0dca3d6fc036c6bf48be32ac83e
 * Versión: 2026.5.27+6-josantoniojimnez
 * Anterior: 2026.5.27+2-josantoniojimnez
 */

import {type IManifestDeployment, ManifestDeploymentKind, Runtime, Target} from "@mr/core-dev/manifest/deployment";
import type {IManifestDeploymentCredenciales} from "@mr/core-dev/manifest/deployment/credenciales";
import type {IManifestDeploymentImagen} from "@mr/core-dev/manifest/deployment/imagen";
import type {IManifestDeploymentKustomize} from "@mr/core-dev/manifest/deployment/kustomize";
import type {IManifestDeploymentStorage} from "@mr/core-dev/manifest/deployment/storage";

import {type IManifestDeploymentLegacy, type IManifestLegacy, RuntimeLegacy} from "../legacy";
import ManifestWorkspaceDeploymentCredencialesLoader from "./credenciales";
import ManifestWorkspaceDeploymentImagenLoader from "./imagen";
import ManifestWorkspaceDeploymentKustomizeLoader from "./kustomize";
import ManifestWorkspaceDeploymentLambdaLoader from "./lambda";
import ManifestWorkspaceDeploymentStorageLoader from "./storage";

type IManifestDeploymentUpdate1 = Exclude<IManifestDeployment, "kustomize"> & {
    kustomize?: string;
}
type IManifestDeploymentUpdate2 = Exclude<IManifestDeployment, "kustomize"> & {
    kustomize: {
        legacy: string;
    };
}

/**
 * Normaliza la sección `deploy` del `mrpack.json` de un workspace.
 *
 * Además de aplicar defaults y compatibilidad con formatos legacy,
 * preserva overlays avanzados como `deploy.annotations` para que se
 * propaguen al modelo tipado final.
 */
class ManifestWorkspaceDeploymentLoader {
    /* INSTANCE */
    public get default(): IManifestDeployment {
        return {
            enabled: true,
            type: ManifestDeploymentKind.SERVICE,
            imagen: ManifestWorkspaceDeploymentImagenLoader.default,
            runtime: Runtime.node,
            target: Target.k8s,
            kustomize: [],//ManifestWorkspaceDeploymentKustomizeLoader.DEFAULT,
        };
    }

    /**
     * Valida y normaliza la configuración de despliegue de un workspace.
     *
     * @param deploy - Bloque `deploy` parcial del manifest (formato actual o legacy).
     * @param names  - Nombres de recursos kustomize asociados al workspace.
     * @returns Configuración `deploy` completa y tipada.
     */
    public check(deploy: Partial<IManifestDeployment|IManifestDeploymentUpdate1|IManifestDeploymentUpdate2|IManifestDeploymentLegacy> = {}, names: string[]): IManifestDeployment {
        const data = this.default;
        if (deploy.enabled) {
            data.enabled = deploy.enabled;
        }
        if (deploy.type) {
            data.type = deploy.type;
        }
        if (deploy.runtime) {
            data.runtime = deploy.runtime;
        }

        switch (data.type) {
            case ManifestDeploymentKind.SERVICE:
            case ManifestDeploymentKind.CRONJOB:
            case ManifestDeploymentKind.JOB:
                if ("target" in deploy && deploy.target) {
                    data.target = deploy.target;
                }
                data.alone = deploy.alone ?? false;
                if ("arch" in deploy) {
                    data.arch = deploy.arch;
                } else {
                    data.arch = [
                        "linux/amd64",
                        "linux/arm64",
                    ];
                }
                if ("buckets" in deploy) {
                    if (deploy.buckets?.produccion && deploy.buckets?.test) {
                        data.buckets = deploy.buckets;
                    }
                }
                data.credenciales = ManifestWorkspaceDeploymentCredencialesLoader.check(deploy.credenciales);
                if (deploy.imagen===undefined) {
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
                } else if (deploy.kustomize) {
                    data.kustomize = [];
                    for (const name of names) {
                        data.kustomize.push(ManifestWorkspaceDeploymentKustomizeLoader.check({
                            ...deploy.kustomize,
                            name,
                        }));
                    }
                }
                if (data.target===Target.lambda) {
                    if ("cloudsql" in deploy) {
                        if (typeof deploy.cloudsql === "string") {
                            data.cloudsql = {
                                produccion: [deploy.cloudsql],
                                test: [deploy.cloudsql],
                            };
                        } else if (Array.isArray(deploy.cloudsql)) {
                            data.cloudsql = {
                                produccion: deploy.cloudsql,
                                test: deploy.cloudsql,
                            };
                        } else {
                            data.cloudsql = deploy.cloudsql;
                        }
                    }
                    if ("lambda" in deploy) {
                        data.lambda = ManifestWorkspaceDeploymentLambdaLoader.check(deploy.lambda);
                    } else {
                        data.lambda = ManifestWorkspaceDeploymentLambdaLoader.default;
                    }
                }
                if (data.type===ManifestDeploymentKind.CRONJOB) {
                    if ("schedule" in deploy && deploy.schedule) {
                        data.schedule = deploy.schedule;
                    } else if (data.target===Target.lambda) {
                        data.schedule = "0 0 31 2 *"
                    }
                }
                // Se preservan anotaciones personalizadas para el recurso service.
                if ("annotations" in deploy && deploy.annotations) {
                    data.annotations = deploy.annotations;
                }
                break;
            case ManifestDeploymentKind.BROWSER:
                data.target = Target.none;
                if (!deploy.storage) {
                    throw new Error(`ManifestDeployment: deploy.storage no definido para "${data.type}"`);
                }
                data.storage = ManifestWorkspaceDeploymentStorageLoader.check(deploy.storage);
                break
            case ManifestDeploymentKind.WORKER:
                data.target = Target.none;
                break;
        }

        return data;
    }

    /**
     * Migra la configuración de despliegue desde el formato legacy al formato actual.
     *
     * @param config - Datos en formato legacy a migrar.
     * @param names  - Nombres de recursos kustomize asociados al workspace.
     * @returns Configuración `deploy` migrada al formato actual.
     */
    public fromLegacy(config: Partial<IManifestLegacy>, names: string[]): IManifestDeployment {
        let type: ManifestDeploymentKind;
        let target: Target;
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
                target = Target.none;
                break;
            case RuntimeLegacy.cfworker:
                runtime = Runtime.cfworker;
                target = Target.none;
                break;
            case RuntimeLegacy.php:
                runtime = Runtime.php;
                target = Target.k8s;
                break;
            case RuntimeLegacy.node:
            default:
                runtime = Runtime.node;
                target = Target.k8s;
                break;
        }

        return {
            enabled: config.deploy ?? true,
            type,
            runtime,
            target,
            alone,
            arch,
            credenciales,
            imagen,
            kustomize,
            storage,
        };
    }
}

export default new ManifestWorkspaceDeploymentLoader();
