/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 11:12:48 GMT
 * Hash: 01b78b10db9db08fb50564dc30dfda52
 * Versión: 2026.5.27+2-josantoniojimnez
 * Anterior: 2026.5.21+5-josantoniojimnez
 */

import {type IManifestDeploymentAnnotations, ManifestDeploymentAnnotations} from "./annotations.ts";
import {type IManifestDeploymentCredenciales, ManifestDeploymentCredenciales} from "./credenciales.ts";
import {type IManifestDeploymentImagen, ManifestDeploymentImagen} from "./imagen/index.ts";
import {type IManifestDeploymentKustomize, ManifestDeploymentKustomize} from "./kustomize/index.ts";
import {type IManifestDeploymentLambda, ManifestDeploymentLambda} from "./lambda/index.ts";
import {type IManifestDeploymentStorage, ManifestDeploymentStorage} from "./storage/index.ts";

/**
 * Entorno de ejecución del artefacto desplegado.
 *
 * - `node` — proceso Node.js en servidor.
 * - `browser` — bundle estático de navegador (sin servidor propio).
 * - `cfworker` — Cloudflare Worker.
 * - `php` — PHP.
 */
export type Runtime = "node" | "browser" | "cfworker" | "php";

export const Runtime: {
    readonly node: Runtime;
    readonly browser: Runtime;
    readonly cfworker: Runtime;
    readonly php: Runtime;
} = {
    node: "node",
    browser: "browser",
    cfworker: "cfworker",
    php: "php",
};

/**
 * Tipo de recurso Kubernetes que genera `mrpack` al desplegar el workspace.
 *
 * - `SERVICE` — Deployment continuo (servicio de larga duración).
 * - `CRONJOB` — CronJob planificado (requiere `schedule`).
 * - `JOB` — Job de ejecución manual (CronJob sin planificación automática).
 * - `BROWSER` — assets estáticos de navegador subidos a Google Cloud Storage.
 * - `WORKER` — Worker.
 */
export type ManifestDeploymentKind = "service" | "cronjob" | "job" | "browser" | "worker";

export const ManifestDeploymentKind: {
    readonly SERVICE: ManifestDeploymentKind;
    readonly CRONJOB: ManifestDeploymentKind;
    readonly JOB: ManifestDeploymentKind;
    readonly BROWSER: ManifestDeploymentKind;
    readonly WORKER: ManifestDeploymentKind;
} = {
    SERVICE: "service",
    CRONJOB: "cronjob",
    JOB: "job",
    BROWSER: "browser",
    WORKER: "worker",
};

/**
 * Infraestructura de destino del despliegue.
 *
 * - `k8s` — Kubernetes (GKE).
 * - `lambda` — Cloud Run / Lambda.
 * - `none` — sin despliegue automático.
 */
export type Target = "k8s" | "lambda" | "none";

export const Target: {
    readonly k8s: Target;
    readonly lambda: Target;
    readonly none: Target;
} = {
    k8s: "k8s",
    lambda: "lambda",
    none: "none",
};

/** Datos de un bucket de Google Storage: clave → nombre de bucket o lista de buckets. */
export type TManifestDeploymentBucketData = Record<string, string|string[]>;

interface IManifestDeploymentBuckets {
    produccion: TManifestDeploymentBucketData;
    test: TManifestDeploymentBucketData;
}

/**
 * Configuración de despliegue de un workspace (`deploy` en `mrpack.json`).
 *
 * @property enabled - Si `false`, `mrpack` omite el despliegue de este workspace.
 * @property type - Tipo de recurso Kubernetes a generar ({@link ManifestDeploymentKind}).
 * @property runtime - Entorno de ejecución del artefacto ({@link Runtime}).
 * @property target - Infraestructura de destino ({@link Target}).
 * @property alone - Solo `SERVICE`/`CRONJOB`/`JOB`. Si `true`, despliega en una sola zona. Por defecto `false`.
 * @property arch - Solo `SERVICE`/`CRONJOB`/`JOB`. Arquitecturas Docker. Por defecto `["linux/amd64","linux/arm64"]`.
 * @property buckets - Solo `SERVICE`/`CRONJOB`/`JOB`. Buckets GCS divididos por entorno.
 * @property credenciales - Solo `SERVICE`/`CRONJOB`/`JOB`. Credenciales a montar en el contenedor.
 * @property imagen - Solo `SERVICE`/`CRONJOB`/`JOB`. Imagen Docker por entorno.
 * @property kustomize - Solo `SERVICE`/`CRONJOB`/`JOB`. Overlays de kustomize.
 * @property cloudsql - Solo `SERVICE`/`CRONJOB`/`JOB` + `target: lambda`. Instancias Cloud SQL a conectar.
 * @property schedule - Solo `CRONJOB`. Expresión cron de planificación.
 * @property storage - Solo `BROWSER`. Configuración de subida de assets a GCS.
 * @property annotations - Solo `SERVICE`/`CRONJOB`/`JOB`. Anotaciones a añadir a los recursos Kubernetes y Cloud Run generados.
 * @property lambda - Solo `SERVICE`/`CRONJOB`/`JOB` + `target: lambda`. Configuración de red de Cloud Run (ingress, egress, VPC).
 */
export interface IManifestDeployment {
    enabled: boolean;
    type: ManifestDeploymentKind;
    runtime: Runtime;
    target: Target;
    alone?: boolean;
    arch?: string[];
    buckets?: { produccion: TManifestDeploymentBucketData; test: TManifestDeploymentBucketData };
    credenciales?: IManifestDeploymentCredenciales[];
    imagen?: IManifestDeploymentImagen;
    kustomize?: IManifestDeploymentKustomize[];
    cloudsql?: { produccion: string[]; test: string[] };
    schedule?: string;
    storage?: IManifestDeploymentStorage;
    annotations?: IManifestDeploymentAnnotations;
    lambda?: IManifestDeploymentLambda;
}

/**
 * Modelo de la sección `deploy` de `mrpack.json`.
 */
export class ManifestDeployment implements IManifestDeployment {
    /* STATIC */
    public static build(deploy: IManifestDeployment): ManifestDeployment {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;
    public type: ManifestDeploymentKind;
    public runtime: Runtime;
    public target: Target;
    public alone?: boolean;
    public arch?: string[];
    public buckets?: IManifestDeploymentBuckets;
    public credenciales?: ManifestDeploymentCredenciales[];
    public imagen?: ManifestDeploymentImagen;
    public kustomize?: ManifestDeploymentKustomize[];
    public cloudsql?: {
        produccion: string[];
        test: string[];
    };
    public schedule?: string;
    public storage?: ManifestDeploymentStorage;
    public annotations?: ManifestDeploymentAnnotations;
    public lambda?: ManifestDeploymentLambda;

    /**
     * `true` cuando el tipo de despliegue es `CRONJOB` o `JOB`.
     * Útil para ejecutar lógica común a ambos tipos de trabajo planificado.
     */
    public get cronjob(): boolean {
        return this.type === ManifestDeploymentKind.CRONJOB || this.type === ManifestDeploymentKind.JOB;
    }

    protected constructor(deploy: IManifestDeployment) {
        this.enabled = deploy.enabled;
        this.type = deploy.type;
        this.target = deploy.target;
        this.runtime = deploy.runtime;
        this.alone = deploy.alone;
        this.arch = deploy.arch;
        this.buckets = deploy.buckets;
        this.credenciales = deploy.credenciales?.map(actual => ManifestDeploymentCredenciales.build(actual));
        this.imagen = ManifestDeploymentImagen.build(deploy.imagen);
        this.kustomize = deploy.kustomize?.map(kustomize=>ManifestDeploymentKustomize.build(kustomize));
        this.cloudsql = deploy.cloudsql;
        this.schedule = deploy.schedule;
        this.storage = ManifestDeploymentStorage.build(deploy.storage);
        this.annotations = deploy.annotations ? ManifestDeploymentAnnotations.build(deploy.annotations) : undefined;
        this.lambda = deploy.lambda ? ManifestDeploymentLambda.build(deploy.lambda) : undefined;
    }

    public toJSON(): IManifestDeployment {
        const credenciales = this.credenciales?.map(actual => actual.toJSON()) ?? [];

        return {
            enabled: this.enabled,
            type: this.type,
            runtime: this.runtime,
            target: this.target,
            alone: this.alone,
            arch: this.arch,
            buckets: this.buckets,
            credenciales: credenciales.length>0?
                credenciales:
                undefined,
            imagen: this.imagen?.toJSON(),
            kustomize: this.kustomize?.map(k=>k.toJSON()),
            cloudsql: this.cloudsql,
            schedule: this.schedule,
            storage: this.storage?.toJSON(),
            annotations: this.annotations?.toJSON(),
            lambda: this.lambda?.toJSON(),
        };
    }
}
