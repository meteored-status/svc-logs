# MRPack Workspace Manifest V1
El archivo de manifiesto de MRPack es un archivo JSON que contiene información sobre el workspace y sus dependencias. El archivo de manifiesto se llama `mrpack.json` y debe estar en la raíz de cada workspace que dará lugar a una compilación.

---
## IManifest
```typescript
interface IManifest {
    enabled: boolean;
    deploy: IManifestDeployment;
    devel: IManifestDevelopment;
    build: IManifestBuild;
}
```
- `enabled`: Indica si el workspace está habilitado o no.
    - **tipo**: boolean
- `deploy`: Información sobre el despliegue.
    - **tipo** [IManifestDeployment](#imanifestdeployment).
- `devel`: Información sobre el desarrollo.
    - **tipo** [IManifestDevelopment](#imanifestdevelopment).
- `build`: Información sobre la compilación.
    - **tipo** [IManifestBuild](#imanifestbuild).

---
## IManifestDeployment
```typescript
interface IManifestDeployment {
    enabled: boolean;
    type: ManifestDeploymentKind;
    runtime: Runtime;
    alone?: boolean;
    arch?: string[];
    credenciales?: IManifestDeploymentCredenciales[];
    imagen?: IManifestDeploymentImagen;
    kustomize?: IManifestDeploymentKustomize[];
    storage?: IManifestDeploymentStorage;
}
```
- `enabled`: Indica si el despliegue está habilitado o no.
    - **tipo**: boolean
- `type`: Tipo de despliegue.
    - **tipo** [ManifestDeploymentKind](#manifestdeploymentkind).
- `runtime`: Información sobre el entorno de ejecución.
    - **tipo** [Runtime](#runtime).
- `target`: Destino donde desplegar la compilación.
    - **tipo** [Target](#target).
- `alone`: Indica si el despliegue se realiza en una sola zona. *Solo es válido para despliegues de tipo `SERVICE`, `CRONJOB` o `JOB`.*
    - **tipo**: boolean
    - **opcional**: Por defecto `false`.
- `arch`: Indica las arquitecturas para las que generar el contenedor. *Solo es válido para despliegues de tipo `SERVICE`, `CRONJOB` o `JOB`.*
    - **tipo**: string
    - **opcional**: Por defecto ["linux/amd64", "linux/arm64"].
- `credenciales`: Credenciales necesarias durante el proceso de despliegue. *Solo es válido para despliegues de tipo `SERVICE`, `CRONJOB` o `JOB`.*
    - **tipo** [IManifestDeploymentCredenciales[]](#imanifestdeploymentcredenciales).
    - **opcional**: Por defecto `[]`.
- `imagen`: Datos sobre la imagen de Docker. *Solo es válido para despliegues de tipo `SERVICE`, `CRONJOB` o `JOB`.*
    - **tipo**: [IManifestDeploymentImagen](#imanifestdeploymentimagen).
    - **opcional**: Por defecto se utiliza la imagen base del entorno de ejecución en el namespace services de GKE en Bélgica.
- `kustomize`: Detalles de kustomización. *Solo es válido para despliegues de tipo `SERVICE`, `CRONJOB` o `JOB`.*
    - **tipo**: [IManifestDeploymentKustomize[]](#imanifestdeploymentkustomize).
    - **opcional**: Ver detalles para más información.
- `storage`: Información sobre el almacenamiento. *Solo es válido para despliegues de tipo `BROWSER`.*
    - **tipo** [IManifestDeploymentStorage](#imanifestdeploymentstorage).
    - **opcional**: No se establece ningún valor por defecto, por lo que es imperativo indicarlo en despliegues de tipo `BROWSER`.

---
## ManifestDeploymentKind
```typescript
enum ManifestDeploymentKind {
    SERVICE = 'service',
    CRONJOB = 'cronjob',
    JOB = 'job',
    BROWSER = 'browser',
    WORKER = 'worker',
}
```
- `SERVICE`: Despliegue de servicio (Deployment).
- `CRONJOB`: Despliegue de cronjob (Cronjob).
- `JOB`: Despliegue de cronjob (Cronjob con ejecución manual).
- `BROWSER`: Se ejecutará en el navegador.
- `WORKER`: Despliegue de worker.

---
## Runtime
```typescript
enum Runtime {
    node = "node",
    browser = "browser",
    cfworker = "cfworker",
    php = "php",
}
```
- `node`: Entorno de ejecución NodeJS.
- `browser`: Entorno de ejecución Browser.
- `cfworker`: Entorno de ejecución Cloudflare Worker.
- `php`: Entorno de ejecución PHP.

---
## Target
```typescript
enum Target {
    k8s = "k8s",
    lambda = "lambda",
    none = "none",
}
```
- `k8s`: Desplegar en Kubernetes.
- `lambda`: Desplegar en una Lambda.
- `none`: Sin despliegue.

---
## IManifestDeploymentCredenciales
```typescript
interface IManifestDeploymentCredenciales {
    source: string;
    target: string;
}
```
- `source`: Archivo de credenciales a importar.
- `target`: Archivo de destino junto con su ruta relativa al workspace.

## IManifestDeploymentImagen

```typescript
interface IManifestDeploymentImagen {
    produccion: IManifestDeploymentImagenEntorno;
    test: IManifestDeploymentImagenEntorno;
}
```

- `produccion`: Datos sobre la imagen de Docker en Producción.
    - **tipo**: [IManifestDeploymentImagenEntorno](#imanifestdeploymentimagenentorno)
- `test`: Datos sobre la imagen de Docker en Test.
    - **tipo**: [IManifestDeploymentImagenEntorno](#imanifestdeploymentimagenentorno)

## IManifestDeploymentImagenEntorno

```typescript
interface IManifestDeploymentImagenEntorno {
    base?: string;
    registro?: string;
    paquete: string;
    nombre: string;
}
```

- `base`: Imagen base en el Dockerfile.
    - **tipo**: string
    - **opcional**: Imagen por defecto del entorno de ejecución.
- `registro`: Registro de Docker a utilizar.
    - **tipo**: string
    - **opcional**: Google Cloud Artifact Registry en Bélgica.
- `paquete`: Paquete dentro del registro.
    - **tipo**: string
- `nombre`: Nombre de la imagen que se va a generar.
    - **tipo**: string

## IManifestDeploymentKustomize

```typescript
interface IManifestDeploymentKustomize {
    name: string;
    dir?: string;
}
```

- `name`: Nombre del workspace dentro del proyecto kustomize.
    - **tipo**: string
- `dir`: Nombre del directorio dentro del proyecto kustomize.
    - **tipo**: string
    - **opcional**: Por defecto se utiliza `services`.

---
## IManifestDeploymentStorage
```typescript
interface IManifestDeploymentStorage {
    buckets: IManifestDeploymentStorageBuckets;
    bundle: string;
    subdirPrefix: string;
    subdir?: string;
    subdirPostfix: string;
    previo?: string[];
}
```
- `buckets`: Buckets en los que desplegar el código.
    - **tipo**: [IManifestDeploymentStorageBuckets](#imanifestdeploymentstoragebuckets).
- `bundle`: Directorio dentro de `output` que se debe subir a los buckets.
    - **tipo**: string
- `subdirPrefix`: Prefijo del subdirectorio.
    - **tipo**: string
- `subdir`: Subdirectorio a utilizar.
    - **tipo**: string
    - **opcional**: Por defecto se utiliza el nombre del workspace.
- `subdirPostfix`: Postfijo del subdirectorio.
    - **tipo**: string
- `previo`: Directorios utilizados anteriormente.
    - **tipo**: string[]
    - **opcional**: Por defecto `[]`.

---
## IManifestDeploymentStorageBuckets
```typescript
interface IManifestDeploymentStorageBuckets {
    produccion: string[];
    test: string[];
}
```
- `produccion`: Lista de buckets en los que desplegar el código en producción.
    - **tipo**: string[]
- `test`: Lista de buckets en los que desplegar el código en test.
    - **tipo**: string[]

---
## IManifestDevelopment
```typescript
interface IManifestDevelopment {
    enabled: boolean;
}
```
- `enabled`: Indica si el desarrollo está habilitado o no.
    - **tipo**: boolean

---
## IManifestBuild
```typescript
interface IManifestBuild {
    deps?: string[]; // workspaces de los que depende el workspace actual
    framework: BuildFW;
    database?: IManifestBuildDatabase;
    bundle?: IManifestBuildBundle;
}
```
- `deps`: Lista de workspaces de los que depende el workspace actual.
    - **tipo**: string[]
    - **opcional**: Por defecto `[]`.
- `framework`: Framework de desarrollo.
    - **tipo** [BuildFW](#buildfw).
- `database`: Nombre de la Base de Datos MySQL por defecto que se va a utilizar.
    - **tipo**: [IManifestBuildDatabase](#imanifestbuilddatabase).
    - **opcional**: Por defecto no se establece ninguna base de datos.
- `bundle`: Información sobre el empaquetado.
    - **tipo** [IManifestBuildBundle](#imanifestbuildbundle).
    - **opcional**: Por defecto no se establece ningún valor.

---
## BuildFW
```typescript
enum BuildFW {
    meteored = "meteored",
    nextjs = "nextjs",
}
```
- `meteored`: Framework de desarrollo Meteored.
- `nextjs`: Framework de desarrollo NextJS.

---
## IManifestBuildBundle
```typescript
interface IManifestBuildBundle extends IManifestBuildBundleBase {
    web?: IManifestBuildBundleBase|IManifestBuildBundleBase[];
}
```
- `web`: Información sobre empaquetados adicionales para la web.
    - **tipo** [IManifestBuildBundleBase](#imanifestbuildbundlebase)|[IManifestBuildBundleBase[]](#imanifestbuildbundlebase)
    - **opcional**: Por defecto se establece `[]`.

---
## IManifestBuildDatabase
```typescript
interface IManifestBuildDatabase {
    produccion?: string;
    test?: string;
}
```
- `produccion`: Nombre de la base de datos para producción.
    - **tipo** string
    - **opcional**
- `test`: Nombre de la base de datos para test.
    - **tipo** string
    - **opcional**

---
## IManifestBuildBundleBase
```typescript
interface IManifestBuildBundleBase {
    componentes?: Partial<IManifestBuildComponentes>;
    entries?: Record<string, string>;
    prefix?: string;
    source_map?: string[];
}
```
- `componentes`: Información sobre los componentes que se ha de utilizar para empaquetar.
    - **tipo** [IManifestBuildComponentes](#imanifestbuildcomponentes).
    - **opcional**: Por defecto no se establece ningún valor.
- `entries`: Entradas a empaquetar.
    - **tipo** Record<string, string>
    - **opcional**: Por defecto no se establece ninguna entrada.
- `prefix`: Prefijo de los archivos empaquetados.
    - **tipo**: string
    - **opcional**: Por defecto no se establece ningún prefijo.
- `source_map`: Archivos de los que se debe generar el source map.
    - **tipo**: string[]
    - **opcional**: Por defecto no se establece ningún archivo.

---
## IManifestBuildComponentes
```typescript
interface IManifestBuildComponentes {
    optimizar: boolean;
    pug: boolean;
    css: ManifestBuildComponentesCSS;
}
```
- `optimizar`: Indica si se deben optimizar los componentes.
    - **tipo**: boolean
- `pug`: Indica si se deben compilar los archivos Pug.
  - **tipo**: boolean
- `css`: Información sobre los estilos.
    - **tipo** [ManifestBuildComponentesCSS](#manifestbuildcomponentescss).

---
## ManifestBuildComponentesCSS
```typescript
enum ManifestBuildComponentesCSS {
    DESACTIVADO = "",
    INYECTADO = "inyectado",
    INDEPENDIENTE = "independiente",
    CRITICAL = "critical",
}
```
- `DESACTIVADO`: No se realiza ninguna acción.
- `INYECTADO`: Se inyectan los estilos en el HTML utilizando `javascript`.
- `INDEPENDIENTE`: Se generan archivos CSS independientes.
- `CRITICAL`: Se generan archivos CSS críticos que van a ser inyectados en el html en el servidor.
