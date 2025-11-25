import {type IManifestDeploymentStorage, ManifestDeploymentStorage} from "./storage";
import {type IManifestDeploymentCredenciales, ManifestDeploymentCredenciales} from "./credenciales";
import {type IManifestDeploymentImagen, ManifestDeploymentImagen} from "./imagen";
import {type IManifestDeploymentKustomize, ManifestDeploymentKustomize} from "./kustomize";

export const enum Runtime {
    node = "node",
    browser = "browser",
    cfworker = "cfworker",
    php = "php",
}

export const enum ManifestDeploymentKind {
    SERVICE = 'service',
    CRONJOB = 'cronjob',
    JOB = 'job',
    BROWSER = 'browser',
    WORKER = 'worker',
}

export interface IManifestDeployment {
    enabled: boolean;
    type: ManifestDeploymentKind; // tipo de despliegue
    runtime: Runtime;
    alone?: boolean; // si solo se ha de desplegar en una zona, solo aplicable a SERVICE/CRONJOB/JOB
    arch?: string[]; // solo aplicable a SERVICE/CRONJOB/JOB
    credenciales?: IManifestDeploymentCredenciales[]; // solo aplicable a SERVICE/CRONJOB/JOB
    imagen?: IManifestDeploymentImagen; // solo aplicable a SERVICE/CRONJOB/JOB
    kustomize?: IManifestDeploymentKustomize[]; // solo aplicable a SERVICE/CRONJOB/JOB
    storage?: IManifestDeploymentStorage; // solo aplicable a BROWSER
}

export class ManifestDeployment implements IManifestDeployment {
    /* STATIC */
    public static build(deploy: IManifestDeployment): ManifestDeployment {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;
    public type: ManifestDeploymentKind;
    public runtime: Runtime;
    public alone?: boolean;
    public arch?: string[];
    public credenciales?: ManifestDeploymentCredenciales[];
    public imagen?: ManifestDeploymentImagen;
    public kustomize?: ManifestDeploymentKustomize[];
    public storage?: ManifestDeploymentStorage;

    public get cronjob(): boolean {
        return this.type === ManifestDeploymentKind.CRONJOB || this.type === ManifestDeploymentKind.JOB;
    }

    protected constructor(deploy: IManifestDeployment) {
        this.enabled = deploy.enabled;
        this.type = deploy.type;
        this.runtime = deploy.runtime;
        this.alone = deploy.alone;
        this.arch = deploy.arch;
        this.credenciales = deploy.credenciales?.map(actual => ManifestDeploymentCredenciales.build(actual));
        this.imagen = ManifestDeploymentImagen.build(deploy.imagen);
        this.kustomize = deploy.kustomize?.map(kustomize=>ManifestDeploymentKustomize.build(kustomize));
        this.storage = ManifestDeploymentStorage.build(deploy.storage);
    }

    public toJSON(): IManifestDeployment {
        const credenciales = this.credenciales?.map(actual => actual.toJSON()) ?? [];

        return {
            enabled: this.enabled,
            type: this.type,
            runtime: this.runtime,
            alone: this.alone,
            arch: this.arch,
            credenciales: credenciales.length>0?
                credenciales:
                undefined,
            imagen: this.imagen?.toJSON(),
            kustomize: this.kustomize?.map(k=>k.toJSON()),
            storage: this.storage?.toJSON(),
        };
    }
}
