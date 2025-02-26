import {type IManifestDeployment, ManifestDeploymentKind, Runtime} from "@mr/cli/manifest/deployment";
import type {IManifestDeploymentCredenciales} from "@mr/cli/manifest/deployment/credenciales";
import type {IManifestDeploymentStorage} from "@mr/cli/manifest/deployment/storage";

import {ManifestWorkspaceDeploymentStorageLoader} from "./storage";
import {type IManifestLegacy, RuntimeLegacy} from "../legacy";
import {ManifestWorkspaceDeploymentCredencialesLoader} from "./credenciales";

export class ManifestWorkspaceDeploymentLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeployment {
        return {
            enabled: true,
            type: ManifestDeploymentKind.SERVICE,
            runtime: Runtime.node,
        };
    }

    public static check(deploy: Partial<IManifestDeployment>={}): IManifestDeployment {
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
                data.credenciales = ManifestWorkspaceDeploymentCredencialesLoader.check(deploy.credenciales);
                data.imagen = deploy.imagen;
                data.kustomize = deploy.kustomize ?? "services";
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

    public static fromLegacy(config: Partial<IManifestLegacy>): IManifestDeployment {
        let type: ManifestDeploymentKind;
        let alone: boolean|undefined;
        let credenciales: IManifestDeploymentCredenciales[]|undefined;
        let imagen: string|undefined;
        let kustomize: string|undefined;
        let storage: IManifestDeploymentStorage|undefined;

        const cronjob = config.cronjob ?? false;
        if (cronjob) {
            type = ManifestDeploymentKind.CRONJOB;
            alone = config.unico ?? false;
            credenciales = ManifestWorkspaceDeploymentCredencialesLoader.fromLegacy(config);
            imagen = config.imagen;
            kustomize = config.kustomize;
        } else {
            switch(config.runtime) {
                case RuntimeLegacy.node:
                case RuntimeLegacy.php:
                    type = ManifestDeploymentKind.SERVICE;
                    alone = config.unico ?? false;
                    imagen = config.imagen;
                    credenciales = ManifestWorkspaceDeploymentCredencialesLoader.fromLegacy(config);
                    kustomize = config.kustomize;
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
            credenciales,
            imagen,
            kustomize,
            storage,
        };
    }

    /* INSTANCE */
}
