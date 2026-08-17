# Manifest — `mrpack.json`

Modelo de datos del archivo de manifiesto que describe cómo se compila y despliega
cada workspace del monorepo. La herramienta `mrpack` lee este fichero desde la raíz
de cada workspace para determinar su configuración.

---

## Estructura del árbol de modelos

```
Manifest  (manifest/index.ts)
├── deploy: ManifestDeployment  (deployment/index.ts)
│   ├── annotations: ManifestDeploymentAnnotations  (deployment/annotations.ts)
│   ├── credenciales: ManifestDeploymentCredenciales[]  (deployment/credenciales.ts)
│   ├── imagen: ManifestDeploymentImagen  (deployment/imagen/index.ts)
│   │   ├── produccion: ManifestDeploymentImagenEntorno  (deployment/imagen/entorno.ts)
│   │   └── test:       ManifestDeploymentImagenEntorno
│   ├── kustomize: ManifestDeploymentKustomize[]  (deployment/kustomize/index.ts)
│   ├── lambda: ManifestDeploymentLambda  (deployment/lambda/index.ts)
│   └── storage: ManifestDeploymentStorage  (deployment/storage/index.ts)
│       └── buckets: ManifestDeploymentStorageBuckets  (deployment/storage/buckets.ts)
├── devel: ManifestDevelopment  (development.ts)
└── build: ManifestBuild  (build/index.ts)
    ├── database: ManifestBuildDatabase  (build/database.ts)
    └── bundle: ManifestBuildBundle  (build/bundle/index.ts)
        ├── (hereda) ManifestBuildBundleBase  (build/bundle/base.ts)
        │   └── componentes: ManifestBuildComponentes  (build/bundle/componentes.ts)
        └── web: ManifestBuildBundleBase[]
```

Todos los nodos heredan de `ManifestRoot<T>` (`root.ts`), que garantiza el contrato
`toJSON(): T` para serializar de vuelta al POJO de `mrpack.json`.

> **Convención JSDoc:** la documentación de propiedades de interfaces y miembros de enums se escribe
> en el bloque JSDoc del propio tipo (con `@property`), no como comentarios inline en cada
> declaración, para reducir el ruido visual dentro del cuerpo del tipo.

---

## Ejemplo mínimo de `mrpack.json`

```json
{
    "enabled": true,
    "deploy": {
        "enabled": true,
        "type": "service",
        "runtime": "node",
        "target": "k8s"
    },
    "devel": {
        "enabled": true
    },
    "build": {
        "framework": "meteored",
        "bundler": "esbuild"
    }
}
```

---

## Referencia de interfaces

### `IManifest`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `enabled` | `boolean` | ✅ | Si `false`, `mrpack` ignora el workspace. |
| `deploy` | `IManifestDeployment` | ✅ | Configuración de despliegue. |
| `devel` | `IManifestDevelopment` | ✅ | Configuración de desarrollo local. |
| `build` | `IManifestBuild` | ✅ | Configuración de compilación. |

---

### `IManifestDeployment`

| Campo | Tipo | Obligatorio | Aplica a | Descripción |
|-------|------|:-----------:|----------|-------------|
| `enabled` | `boolean` | ✅ | todos | Si `false`, omite el despliegue. |
| `type` | `ManifestDeploymentKind` | ✅ | todos | Tipo de recurso Kubernetes. |
| `runtime` | `Runtime` | ✅ | todos | Entorno de ejecución del artefacto. |
| `target` | `Target` | ✅ | todos | Infraestructura de destino. |
| `alone` | `boolean` | — | SERVICE/CRONJOB/JOB | Solo despliega en una zona. |
| `arch` | `string[]` | — | SERVICE/CRONJOB/JOB | Arquitecturas Docker. Por defecto `["linux/amd64","linux/arm64"]`. |
| `buckets` | `{ produccion, test }` | — | SERVICE/CRONJOB/JOB | Buckets GCS por entorno. |
| `credenciales` | `IManifestDeploymentCredenciales[]` | — | SERVICE/CRONJOB/JOB | Credenciales a montar. |
| `imagen` | `IManifestDeploymentImagen` | — | SERVICE/CRONJOB/JOB | Imagen Docker por entorno. |
| `kustomize` | `IManifestDeploymentKustomize[]` | — | SERVICE/CRONJOB/JOB | Overlays de kustomize. |
| `cloudsql` | `{ produccion, test }` | — | SERVICE/CRONJOB/JOB + lambda | Instancias Cloud SQL. |
| `schedule` | `string` | — | CRONJOB | Expresión cron. |
| `storage` | `IManifestDeploymentStorage` | — | BROWSER | Subida de assets a GCS. |
| `annotations` | `IManifestDeploymentAnnotations` | — | SERVICE/CRONJOB/JOB | Anotaciones adicionales para recursos generados (K8s/Cloud Run). |
| `lambda` | `IManifestDeploymentLambda` | — | SERVICE/CRONJOB/JOB + lambda | Configuración de red de Cloud Run (egress/ingress). |
| `env` | `Record<string, string>` | — | SERVICE/CRONJOB/JOB + lambda | Variables de entorno adicionales a inyectar en el contenedor `{ NOMBRE: valor }`. |

#### `ManifestDeploymentKind`

| Valor | Descripción |
|-------|-------------|
| `"service"` | Deployment continuo. |
| `"cronjob"` | CronJob planificado (requiere `schedule`). |
| `"job"` | Job de ejecución manual. |
| `"browser"` | Assets estáticos subidos a GCS (requiere `storage`). |
| `"worker"` | Worker. |

#### `Runtime`

| Valor | Descripción |
|-------|-------------|
| `"node"` | Proceso Node.js. |
| `"browser"` | Bundle de navegador. |
| `"cfworker"` | Cloudflare Worker. |
| `"php"` | PHP. |

#### `Target`

| Valor | Descripción |
|-------|-------------|
| `"k8s"` | Kubernetes (GKE). |
| `"lambda"` | Cloud Run / Lambda. |
| `"none"` | Sin despliegue automático. |

---

### `IManifestDeploymentCredenciales`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `source` | `string` | Ruta al fichero de credenciales en el sistema origen. |
| `target` | `string` | Ruta destino en el contenedor (relativa al workspace). |

---

### `IManifestDeploymentImagen`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `produccion` | `IManifestDeploymentImagenEntorno` | Imagen para producción. |
| `test` | `IManifestDeploymentImagenEntorno` | Imagen para test/staging. |

#### `IManifestDeploymentImagenEntorno`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `paquete` | `string` | ✅ | Repositorio dentro del registro Docker. |
| `nombre` | `string` | ✅ | Nombre de la imagen generada. |
| `base` | `string` | — | Imagen base del Dockerfile. Por defecto la del runtime. |
| `registro` | `string` | — | Registro Docker. Por defecto el de `mrpack`. |

---

### `IManifestDeploymentKustomize`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `name` | `string` | ✅ | Nombre del workspace en el proyecto kustomize. |
| `dir` | `string` | — | Subdirectorio del overlay. Por defecto `"services"`. |
| `credenciales` | `Record<string, string>` | — | Secretos de credenciales `{ nombre: ruta }`. |
| `ssl` | `Record<string, string>` | — | Secretos SSL `{ nombre: ruta }`. |

---

### `IManifestDeploymentAnnotations`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `service` | `Record<string, string>` | Mapa de anotaciones a inyectar en el recurso de servicio (`metadata.annotations`). |

Ejemplo:

```json
{
    "deploy": {
        "type": "service",
        "runtime": "node",
        "target": "lambda",
        "annotations": {
            "service": {
                "run.googleapis.com/ingress": "all"
            }
        }
    }
}
```

---

### `IManifestDeploymentLambda`

Configuración de red de Cloud Run para despliegues con `target: "lambda"`.

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `ingress` | `Ingress` | ✅ | Tráfico entrante permitido. Por defecto `"internal-and-cloud-load-balancing"`. |
| `egress` | `Egress` | — | Tráfico saliente. Solo aplica cuando `vpc` es `true`. |
| `vpc` | `boolean` | ✅ | Si `true`, el servicio se conecta a la VPC del proyecto. Por defecto `false`. |

#### `Ingress`

| Valor | Descripción |
|-------|-------------|
| `"all"` | Permite todo el tráfico entrante (público). |
| `"internal-and-cloud-load-balancing"` | Solo tráfico interno y load balancer. |

#### `Egress`

| Valor | Descripción |
|-------|-------------|
| `"all-traffic"` | Todo el tráfico sale por VPC. |
| `"private-ranges-only"` | Solo tráfico a rangos privados sale por VPC. |

Ejemplo:

```json
{
    "deploy": {
        "type": "service",
        "runtime": "node",
        "target": "lambda",
        "lambda": {
            "ingress": "all",
            "egress": "private-ranges-only",
            "vpc": true
        }
    }
}
```

---

### `env`

Variables de entorno adicionales a inyectar en el contenedor, solo para despliegues con `target: "lambda"`. Por ahora no aplica al path k8s/kustomize.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `env` | `Record<string, string>` | Mapa `{ NOMBRE: valor }` de variables de entorno. |

Ejemplo:

```json
{
    "deploy": {
        "type": "service",
        "runtime": "node",
        "target": "lambda",
        "env": {
            "MI_VARIABLE": "valor"
        }
    }
}
```

---

### `IManifestDeploymentStorage`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `buckets` | `IManifestDeploymentStorageBuckets` | ✅ | Buckets GCS de destino. |
| `bundle` | `string` | ✅ | Subdirectorio de `output/` a subir. |
| `subdirPrefix` | `string` | ✅ | Prefijo del directorio en el bucket. |
| `subdirPostfix` | `string` | ✅ | Sufijo del directorio en el bucket. |
| `subdir` | `string` | — | Directorio en el bucket. Por defecto nombre del workspace. |
| `previo` | `string[]` | — | Directorios anteriores a mantener (URLs legacy). |

#### `IManifestDeploymentStorageBuckets`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `produccion` | `string[]` | Buckets de producción. |
| `test` | `string[]` | Buckets de test/staging. |

---

### `IManifestDevelopment`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `enabled` | `boolean` | Si `true`, el workspace puede levantarse con `yarn devel`. |

---

### `IManifestBuild`

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `framework` | `BuildFW` | ✅ | Framework de compilación. |
| `bundler` | `BuildBundler` | ✅ | Bundler efectivo de compilación. |
| `deps` | `string[]` | — | Workspaces del monorepo requeridos en tiempo de build. |
| `database` | `IManifestBuildDatabase` | — | Nombre de BD MySQL por entorno. |
| `bundle` | `IManifestBuildBundle` | — | Configuración del empaquetado de assets. |

#### `BuildFW`

| Valor | Descripción |
|-------|-------------|
| `"meteored"` | Framework propio Meteored (rspack). |
| `"nextjs"` | Next.js. |

---

#### `BuildBundler`

| Valor | Descripción |
|-------|-------------|
| `"rspack"` | Bundler rspack de `@mr/core-dev`. |
| `"esbuild"` | Bundler esbuild. |
| `"none"` | Sin fase de bundling. |

---

### `IManifestBuildDatabase`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `produccion` | `string` | Nombre de la BD en producción. |
| `test` | `string` | Nombre de la BD en test/staging. |

---

### `IManifestBuildBundle` / `IManifestBuildBundleBase`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `componentes` | `Partial<IManifestBuildComponentes>` | Pipeline de componentes. |
| `entries` | `Record<string, string>` | Entradas del bundle `{ nombre: ruta }`. |
| `prefix` | `string` | Prefijo de los ficheros de salida. |
| `source_map` | `string[]` | Módulos con source map explícito. |
| `web` | `IManifestBuildBundleBase \| IManifestBuildBundleBase[]` | Bundles web adicionales (solo en `IManifestBuildBundle`). |

---

### `IManifestBuildComponentes`

| Campo | Tipo | Por defecto | Descripción |
|-------|------|-------------|-------------|
| `optimizar` | `boolean` | `true` | Optimización rspack de componentes. |
| `pug` | `boolean` | `false` | Compilación de plantillas Pug. |
| `css` | `ManifestBuildComponentesCSS` | `""` (desactivado) | Estrategia de procesado CSS. |

#### `ManifestBuildComponentesCSS`

| Valor | Descripción |
|-------|-------------|
| `""` | Sin CSS. |
| `"inyectado"` | Inyectado en el DOM vía JS. |
| `"independiente"` | Ficheros `.css` independientes. |
| `"critical"` | CSS crítico inyectado inline por el servidor. |
| `"string"` | Exportado como string (SSR / componentes aislados). |
