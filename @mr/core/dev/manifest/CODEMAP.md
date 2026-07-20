# CODEMAP — `@mr/core/dev/manifest/`

> Generado: 2026-06-15. Actualizar tras cambios significativos.
> Paquete npm: `@mr/core-dev`. Importar como `@mr/core-dev/manifest`.

---

## Árbol de directorios

```
manifest/
├── index.ts              IManifest, Manifest — modelo raíz del mrpack.json
├── root.ts               ManifestRoot<T> — clase base abstracta de todos los nodos
├── development.ts        IManifestDevelopment, ManifestDevelopment — sección `devel`
│
├── build/
│   ├── index.ts          IManifestBuild, ManifestBuild — sección `build`; types BuildFW y BuildBundler
│   ├── database.ts       IManifestBuildDatabase, ManifestBuildDatabase — campo `build.database`
│   └── bundle/
│       ├── index.ts      IManifestBuildBundle, ManifestBuildBundle — campo `build.bundle`
│       ├── base.ts       IManifestBuildBundleBase, ManifestBuildBundleBase — base compartida
│       └── componentes.ts  IManifestBuildComponentes, ManifestBuildComponentes, ManifestBuildComponentesCSS
│
└── deployment/
    ├── index.ts          IManifestDeployment, ManifestDeployment — sección `deploy`; Runtime, Target, ManifestDeploymentKind
    ├── annotations.ts    IManifestDeploymentAnnotations, ManifestDeploymentAnnotations
    ├── credenciales.ts   IManifestDeploymentCredenciales, ManifestDeploymentCredenciales
    ├── imagen/
    │   ├── index.ts      IManifestDeploymentImagen, ManifestDeploymentImagen
    │   └── entorno.ts    IManifestDeploymentImagenEntorno, ManifestDeploymentImagenEntorno
    ├── kustomize/
    │   └── index.ts      IManifestDeploymentKustomize, ManifestDeploymentKustomize
    ├── lambda/
    │   └── index.ts      IManifestDeploymentLambda, ManifestDeploymentLambda; Egress, Ingress
    └── storage/
        ├── index.ts      IManifestDeploymentStorage, ManifestDeploymentStorage
        └── buckets.ts    IManifestDeploymentStorageBuckets, ManifestDeploymentStorageBuckets
```

---

## Convención general

Todos los nodos siguen el mismo patrón:
- Interfaz POJO `IManifestXxx` — forma serializada (lo que está en el JSON).
- Clase `ManifestXxx` — modelo instanciado con valores por defecto y métodos.
- `static build(data)` — factory desde el POJO (retorna `undefined` si los datos son opcionales y no existen).
- `toJSON()` — serializa de vuelta al POJO; omite campos opcionales no definidos.

---

## `index.ts` — raíz

```ts
export interface IManifest {
    enabled: boolean;
    deploy: IManifestDeployment;
    devel:  IManifestDevelopment;
    build:  IManifestBuild;
}

export class Manifest extends ManifestRoot<IManifest> implements IManifest {
    public enabled: boolean
    public deploy:  ManifestDeployment
    public devel:   ManifestDevelopment
    public build:   ManifestBuild
    public constructor(manifest: IManifest)
    public toJSON(): IManifest
}
```

## `root.ts`

```ts
export abstract class ManifestRoot<T> {
    public abstract toJSON(): T
}
```

---

## `development.ts`

```ts
export interface IManifestDevelopment {
    enabled: boolean;   // si true, participa en `yarn devel`
}

export class ManifestDevelopment implements IManifestDevelopment {
    public static build(devel: IManifestDevelopment): ManifestDevelopment
    public enabled: boolean
    public toJSON(): IManifestDevelopment
}
```

---

## `build/index.ts`

```ts
// Framework de compilación
export type BuildFW = "meteored" | "nextjs"
export const BuildFW: { readonly meteored: BuildFW; readonly nextjs: BuildFW }

// Bundler de compilación efectivo
export type BuildBundler = "rspack" | "esbuild" | "none"
export const BuildBundler: {
    readonly rspack: BuildBundler;
    readonly esbuild: BuildBundler;
    readonly none: BuildBundler;
}

export interface IManifestBuild {
    framework: BuildFW;
    bundler: BuildBundler;
    deps?:     string[];                   // workspaces requeridos en build
    database?: IManifestBuildDatabase;
    bundle?:   IManifestBuildBundle;
}

export class ManifestBuild implements IManifestBuild {
    public static build(build: IManifestBuild): ManifestBuild
    public framework: BuildFW
    public bundler: BuildBundler
    public deps:      string[]             // default []
    public database?: ManifestBuildDatabase
    public bundle:    ManifestBuildBundle
    public toJSON(): IManifestBuild
}
```

## `build/database.ts`

```ts
export interface IManifestBuildDatabase {
    produccion?: string;
    test?:       string;
}

export class ManifestBuildDatabase implements IManifestBuildDatabase {
    public static build(database?: IManifestBuildDatabase): ManifestBuildDatabase | undefined
    public produccion?: string
    public test?:       string
    public toJSON(): IManifestBuildDatabase
}
```

## `build/bundle/index.ts`

```ts
// Extiende BundleBase añadiendo bundles web adicionales
export interface IManifestBuildBundle extends IManifestBuildBundleBase {
    web?: IManifestBuildBundleBase | IManifestBuildBundleBase[];
}

export class ManifestBuildBundle extends ManifestBuildBundleBase implements IManifestBuildBundle {
    public static override build(bundle?: IManifestBuildBundle): ManifestBuildBundle
    public web: ManifestBuildBundleBase[]   // siempre normalizado a array
    public override toJSON(): IManifestBuildBundle | undefined
}
```

## `build/bundle/base.ts`

```ts
export interface IManifestBuildBundleBase {
    componentes?: Partial<IManifestBuildComponentes>;
    entries?:     Record<string, string>;  // { nombre: ruta }
    prefix?:      string;
    source_map?:  string[];
}

export class ManifestBuildBundleBase implements IManifestBuildBundleBase {
    public static build(bundle?: IManifestBuildBundleBase): ManifestBuildBundleBase | undefined
    public componentes: ManifestBuildComponentes
    public entries?:    Record<string, string>
    public prefix?:     string
    public source_map?: string[]
    public toJSON(): Partial<IManifestBuildBundleBase> | undefined
}
```

## `build/bundle/componentes.ts`

```ts
// Modo de procesado CSS
export type ManifestBuildComponentesCSS = "" | "inyectado" | "independiente" | "critical" | "string"
export const ManifestBuildComponentesCSS: {
    readonly DESACTIVADO:  ManifestBuildComponentesCSS;  // ""
    readonly INYECTADO:    ManifestBuildComponentesCSS;  // "inyectado"
    readonly INDEPENDIENTE:ManifestBuildComponentesCSS;  // "independiente"
    readonly CRITICAL:     ManifestBuildComponentesCSS;  // "critical"
    readonly STRING:       ManifestBuildComponentesCSS;  // "string"
}

export interface IManifestBuildComponentes {
    optimizar: boolean;                      // default true
    pug:       boolean;                      // default false
    css:       ManifestBuildComponentesCSS;  // default DESACTIVADO
}

export class ManifestBuildComponentes implements IManifestBuildComponentes {
    public static build(componentes?: Partial<IManifestBuildComponentes>): ManifestBuildComponentes
    public optimizar: boolean
    public pug:       boolean
    public css:       ManifestBuildComponentesCSS
    public toJSON(): Partial<IManifestBuildComponentes> | undefined  // omite valores por defecto
}
```

---

## `deployment/index.ts`

```ts
// Entorno de ejecución
export type Runtime = "node" | "browser" | "cfworker" | "php"
export const Runtime: { readonly node; readonly browser; readonly cfworker; readonly php }

// Tipo de recurso Kubernetes
export type ManifestDeploymentKind = "service" | "cronjob" | "job" | "browser" | "worker"
export const ManifestDeploymentKind: { readonly SERVICE; readonly CRONJOB; readonly JOB; readonly BROWSER; readonly WORKER }

// Infraestructura de destino
export type Target = "k8s" | "lambda" | "none"
export const Target: { readonly k8s; readonly lambda; readonly none }

export type TManifestDeploymentBucketData = Record<string, string | string[]>

export interface IManifestDeployment {
    enabled:      boolean;
    type:         ManifestDeploymentKind;
    runtime:      Runtime;
    target:       Target;
    alone?:       boolean;
    arch?:        string[];
    buckets?:     { produccion: TManifestDeploymentBucketData; test: TManifestDeploymentBucketData };
    credenciales?:IManifestDeploymentCredenciales[];
    imagen?:      IManifestDeploymentImagen;
    kustomize?:   IManifestDeploymentKustomize[];
    cloudsql?:    { produccion: string[]; test: string[] };
    schedule?:    string;                  // solo CRONJOB
    storage?:     IManifestDeploymentStorage;  // solo BROWSER
    annotations?: IManifestDeploymentAnnotations;
    lambda?:      IManifestDeploymentLambda;   // solo target=lambda
}

export class ManifestDeployment implements IManifestDeployment {
    public static build(deploy: IManifestDeployment): ManifestDeployment
    public enabled:      boolean
    public type:         ManifestDeploymentKind
    public runtime:      Runtime
    public target:       Target
    public alone?:       boolean
    public arch?:        string[]
    public buckets?:     { produccion: TManifestDeploymentBucketData; test: TManifestDeploymentBucketData }
    public credenciales?:ManifestDeploymentCredenciales[]
    public imagen?:      ManifestDeploymentImagen
    public kustomize?:   ManifestDeploymentKustomize[]
    public cloudsql?:    { produccion: string[]; test: string[] }
    public schedule?:    string
    public storage?:     ManifestDeploymentStorage
    public annotations?: ManifestDeploymentAnnotations
    public lambda?:      ManifestDeploymentLambda
    public get cronjob(): boolean    // true si type === CRONJOB || JOB
    public toJSON(): IManifestDeployment
}
```

## `deployment/annotations.ts`

```ts
export interface IManifestDeploymentAnnotations {
    service?: Record<string, string>;
}

export class ManifestDeploymentAnnotations implements IManifestDeploymentAnnotations {
    public static build(deploy?: IManifestDeploymentAnnotations): ManifestDeploymentAnnotations
    public service?: Record<string, string>
    public toJSON(): IManifestDeploymentAnnotations
}
```

## `deployment/credenciales.ts`

```ts
export interface IManifestDeploymentCredenciales {
    source: string;   // ruta origen en el sistema de secretos
    target: string;   // ruta destino relativa al workspace
}

export class ManifestDeploymentCredenciales implements IManifestDeploymentCredenciales {
    public static build(credenciales: IManifestDeploymentCredenciales): ManifestDeploymentCredenciales
    public source: string
    public target: string
    public toJSON(): IManifestDeploymentCredenciales
}
```

## `deployment/imagen/index.ts` + `entorno.ts`

```ts
export interface IManifestDeploymentImagenEntorno {
    paquete:    string;
    nombre:     string;
    base?:      string;     // imagen base FROM
    registro?:  string;     // registro Docker
}

export class ManifestDeploymentImagenEntorno {
    public static build(entorno: IManifestDeploymentImagenEntorno): ManifestDeploymentImagenEntorno
    public paquete: string; public nombre: string; public base?: string; public registro?: string
    public toJSON(): IManifestDeploymentImagenEntorno
}

export interface IManifestDeploymentImagen {
    produccion: IManifestDeploymentImagenEntorno;
    test:       IManifestDeploymentImagenEntorno;
}

export class ManifestDeploymentImagen {
    public static build(imagen?: IManifestDeploymentImagen): ManifestDeploymentImagen | undefined
    public produccion: ManifestDeploymentImagenEntorno
    public test:       ManifestDeploymentImagenEntorno
    public toJSON(): IManifestDeploymentImagen
}
```

## `deployment/kustomize/index.ts`

```ts
export interface IManifestDeploymentKustomize {
    name:          string;
    dir?:          string;                   // default "services"
    credenciales?: Record<string, string>;   // { nombre: ruta }
    ssl?:          Record<string, string>;   // { nombre: ruta }
}

export class ManifestDeploymentKustomize {
    public static build(deploy: IManifestDeploymentKustomize): ManifestDeploymentKustomize
    public name: string; public dir?: string
    public credenciales?: Record<string, string>; public ssl?: Record<string, string>
    public toJSON(): IManifestDeploymentKustomize
}
```

## `deployment/lambda/index.ts`

```ts
// Tráfico saliente Cloud Run
export type Egress = "all-traffic" | "private-ranges-only"
export const Egress: { readonly all: Egress; readonly private: Egress }

// Tráfico entrante Cloud Run
export type Ingress = "all" | "internal-and-cloud-load-balancing"
export const Ingress: { readonly all: Ingress; readonly internal: Ingress }

export interface IManifestDeploymentLambda {
    ingress: Ingress;
    vpc:     boolean;
    egress?: Egress;
}

export class ManifestDeploymentLambda {
    public static build(deploy: IManifestDeploymentLambda): ManifestDeploymentLambda
    public ingress: Ingress; public vpc: boolean; public egress?: Egress
    public toJSON(): IManifestDeploymentLambda
}
```

## `deployment/storage/index.ts` + `buckets.ts`

```ts
export interface IManifestDeploymentStorageBuckets {
    produccion: string[];
    test:       string[];
}

export class ManifestDeploymentStorageBuckets {
    public static build(buckets: IManifestDeploymentStorageBuckets): ManifestDeploymentStorageBuckets
    public produccion: string[]; public test: string[]
    public toJSON(): IManifestDeploymentStorageBuckets
}

export interface IManifestDeploymentStorage {
    buckets:       IManifestDeploymentStorageBuckets;
    bundle:        string;        // subdirectorio de output/ a subir
    subdirPrefix:  string;
    subdirPostfix: string;
    subdir?:       string;        // default: nombre del workspace
    previo?:       string[];      // dirs anteriores a mantener
}

export class ManifestDeploymentStorage {
    public static build(storage?: IManifestDeploymentStorage): ManifestDeploymentStorage | undefined
    public buckets: ManifestDeploymentStorageBuckets
    public bundle: string; public subdirPrefix: string; public subdirPostfix: string; public subdir?: string
    public toJSON(): IManifestDeploymentStorage
}
```

---

## Imports de uso frecuente

```ts
// Modelo completo
import {Manifest} from "@mr/core-dev/manifest";

// Enums/tipos de uso frecuente
import {BuildFW} from "@mr/core-dev/manifest/build";
import {Runtime, Target, ManifestDeploymentKind} from "@mr/core-dev/manifest/deployment";

// Solo tipos (tree-shaking)
import type {IManifest} from "@mr/core-dev/manifest";
import type {IManifestDeployment} from "@mr/core-dev/manifest/deployment";
```

---

## Jerarquía de composición

```
Manifest
├── .build   → ManifestBuild
│   ├── .database? → ManifestBuildDatabase
│   └── .bundle    → ManifestBuildBundle (extends ManifestBuildBundleBase)
│       ├── .componentes → ManifestBuildComponentes
│       └── .web[]       → ManifestBuildBundleBase[]
├── .devel   → ManifestDevelopment
└── .deploy  → ManifestDeployment
    ├── .credenciales[]? → ManifestDeploymentCredenciales[]
    ├── .imagen?          → ManifestDeploymentImagen
    │   ├── .produccion   → ManifestDeploymentImagenEntorno
    │   └── .test         → ManifestDeploymentImagenEntorno
    ├── .kustomize[]?     → ManifestDeploymentKustomize[]
    ├── .storage?         → ManifestDeploymentStorage  (solo BROWSER)
    │   └── .buckets      → ManifestDeploymentStorageBuckets
    ├── .annotations?     → ManifestDeploymentAnnotations
    └── .lambda?          → ManifestDeploymentLambda   (solo target=lambda)
```
