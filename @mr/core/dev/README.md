# `@mr/core-dev`

Paquete de infraestructura de desarrollo compartida por todos los workspaces del monorepo.
Proporciona los **tipos globales de entorno**, las **configuraciones TypeScript base** (Node y browser)
y el **modelo de manifiesto** (`mrpack.json`) que describe cómo se compila y despliega cada workspace.

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Variables globales](#variables-globales-de-entorno) | `@mr/core-dev/types` | Tipos globales inyectados por el bundler (`PRODUCCION`, `ENTORNO`, …) |
| [tsconfig · Node](#tsconfig--node) | `@mr/core-dev/tsconfig.json` (condición `node`) | Configuración TypeScript para servicios Node.js |
| [tsconfig · Browser](#tsconfig--browser) | `@mr/core-dev/tsconfig.json` (condición `browser`) | Configuración TypeScript para bundles de navegador |
| [Manifest](#manifest-mrpackjson) | `@mr/core-dev/manifest` | Modelo de datos del archivo `mrpack.json` |
| [Bundler rspack](#bundler-rspack) | `bundler/rspack/rspack.config.ts` | Configuración rspack compartida por todos los workspaces |
| [Parches de migración](#parches-de-migración-mrpackpatch) | — | Autofix de imports deprecados; se aplica tras `yarn mrpack update` |

---

## Variables globales de entorno

**Entrada:** `@mr/core-dev/types`
**Fichero:** `types.d.ts`

Variables globales inyectadas en tiempo de compilación por el bundler (rspack/webpack). Disponibles
en cualquier workspace que extienda los tsconfigs de este paquete — los tsconfigs Node y Browser
incluyen `"types": ["@mr/core-dev"]`, de modo que no es necesario ningún `import` explícito.

Si el workspace usa un tsconfig propio que **no** extiende los de `@mr/core-dev`, añadir
manualmente:

```ts
import "@mr/core-dev/types"; // amplía el scope global; no exporta nada
```

o bien añadir `"@mr/core-dev"` al array `types` del tsconfig.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `PRODUCCION` | `boolean` | `true` cuando el bundle se compiló en **modo producción** (optimizado). Abarca los entornos de producción Y test; usar `TEST` para distinguirlos. |
| `TEST` | `boolean` | `true` únicamente en el entorno de **test/staging**. Solo puede ser `true` junto con `PRODUCCION=true`. |
| `DESARROLLO` | `boolean` | `true` cuando el bundle se compiló en **modo desarrollo** local. `PRODUCCION` y `TEST` son siempre `false` en este modo. |
| `NEXTJS` | `boolean` | `true` cuando el código se ejecuta dentro de un runtime Next.js. |
| `ENTORNO` | `string` | Nombre del entorno activo (`"produccion"`, `"test"`, `"desarrollo"`, …). |
| `DATABASE` | `string \| undefined` | Nombre de la base de datos MySQL activa. `undefined` si el workspace no usa BD. |

### Combinaciones válidas

| Entorno real | `PRODUCCION` | `TEST` | `DESARROLLO` |
|---|:---:|:---:|:---:|
| Producción | `true` | `false` | `false` |
| Test / staging | `true` | `true` | `false` |
| Desarrollo local | `false` | `false` | `true` |

### Uso

```ts
if (PRODUCCION) {
    // código exclusivo de producción
}

if (DATABASE !== undefined) {
    // el workspace tiene base de datos configurada
}
```

> Las variables son **reemplazadas por literales** en el bundle final (tree-shaking total).
> No existen en runtime: el bundler sustituye cada referencia por su valor booleano/string.

---

## tsconfig · Node

**Entrada:** `@mr/core-dev/tsconfig.json` (condición de exportación `node`)
**Fichero:** `tsconfig/node.json`

Configuración base para todos los servicios Node.js del monorepo. Extiende
`@tsconfig/node24/tsconfig.json` con las siguientes opciones adicionales:

| Opción | Valor | Notas |
|--------|-------|-------|
| `module` | `"preserve"` | Conserva `import`/`export` para el bundler |
| `moduleResolution` | `"bundler"` | Resolución optimizada para rspack/webpack |
| `lib` | `["es2023", "esnext.disposable", "dom"]` | Incluye DOM para acceso a `WebSocket`, `fetch`, etc. |
| `types` | `["node"]` | Solo tipos de Node; los tipos de navegador vienen de `lib` |
| `jsx` | `"react"` | Permite JSX en ficheros `.tsx` |
| `strictNullChecks` | `true` | |
| `noImplicitOverride` | `true` | |
| `noImplicitReturns` | `true` | |
| `noPropertyAccessFromIndexSignature` | `true` | |
| `incremental` | `true` | Compilaciones incrementales con `.tsbuildinfo` |
| `removeComments` | `true` | Se eliminan comentarios en el output |
| `sourceMap` | `true` | |

```jsonc
// tsconfig.json de cualquier servicio Node
{
    "extends": "@mr/core-dev/tsconfig.json"  // resuelve a tsconfig/node.json
}
```

---

## tsconfig · Browser

**Entrada:** `@mr/core-dev/tsconfig.json` (condición de exportación `browser`)
**Fichero:** `tsconfig/browser.json`

Configuración base para bundles de navegador. Extiende `@tsconfig/recommended` con:

| Opción | Valor | Notas |
|--------|-------|-------|
| `target` | `"es2015"` | Compatibilidad amplia |
| `module` | `"esnext"` | |
| `moduleResolution` | `"bundler"` | |
| `lib` | `["es2015", "dom"]` | |
| `allowJs` | `true` | Permite mezclar JS y TS |
| `downlevelIteration` | `true` | Iteradores correctos en ES2015 |
| `removeComments` | `false` | Se conservan comentarios (licencias, etc.) |
| `strictNullChecks` | `true` | |
| `noImplicitAny` | `true` | |
| `sourceMap` | `true` | |

---

## Manifest (`mrpack.json`)

**Entradas:** `@mr/core-dev/manifest` y subpaths
**Ficheros:** `manifest/`
**Documentación completa:** [`manifest/README.md`](./manifest/README.md)

El modelo de datos que describe cómo se compila y despliega cada workspace del monorepo.
Cada workspace que produce una build debe incluir un archivo `mrpack.json` en su raíz.

```ts
import type {IManifest} from "@mr/core-dev/manifest";
import {Manifest} from "@mr/core-dev/manifest";

const manifest = new Manifest(JSON.parse(fs.readFileSync("mrpack.json", "utf8")));
```

### Subpaths disponibles

| Import | Contenido |
|--------|-----------|
| `@mr/core-dev/manifest` | `Manifest`, `IManifest` |
| `@mr/core-dev/manifest/root` | `ManifestRoot<T>` — clase base abstracta |
| `@mr/core-dev/manifest/build` | `ManifestBuild`, `IManifestBuild`, `BuildFW` |
| `@mr/core-dev/manifest/build/bundle` | `ManifestBuildBundle`, `IManifestBuildBundle` |
| `@mr/core-dev/manifest/build/bundle/base` | `ManifestBuildBundleBase`, `IManifestBuildBundleBase` |
| `@mr/core-dev/manifest/build/bundle/componentes` | `ManifestBuildComponentes`, `ManifestBuildComponentesCSS` |
| `@mr/core-dev/manifest/build/database` | `ManifestBuildDatabase`, `IManifestBuildDatabase` |
| `@mr/core-dev/manifest/deployment` | `ManifestDeployment`, `IManifestDeployment`, `Runtime`, `Target`, `ManifestDeploymentKind` |
| `@mr/core-dev/manifest/deployment/credenciales` | `ManifestDeploymentCredenciales`, `IManifestDeploymentCredenciales` |
| `@mr/core-dev/manifest/deployment/imagen` | `ManifestDeploymentImagen`, `IManifestDeploymentImagen` |
| `@mr/core-dev/manifest/deployment/imagen/entorno` | `ManifestDeploymentImagenEntorno`, `IManifestDeploymentImagenEntorno` |
| `@mr/core-dev/manifest/deployment/kustomize` | `ManifestDeploymentKustomize`, `IManifestDeploymentKustomize` |
| `@mr/core-dev/manifest/deployment/storage` | `ManifestDeploymentStorage`, `IManifestDeploymentStorage` |
| `@mr/core-dev/manifest/deployment/storage/buckets` | `ManifestDeploymentStorageBuckets`, `IManifestDeploymentStorageBuckets` |
| `@mr/core-dev/manifest/development` | `ManifestDevelopment`, `IManifestDevelopment` |


---

## Bundler rspack

**Ficheros:** `bundler/rspack/`
**Documentación completa:** [`bundler/rspack/README.md`](./bundler/rspack/README.md)

Módulo que genera la configuración de rspack para todos los workspaces del monorepo.
Cada workspace solo necesita un `rspack.config.ts` que re-exporte la función de entrada:

```ts
// rspack.config.ts de cualquier workspace
export {default} from "@mr/core-dev/bundler/rspack/rspack.config";
```

### Arquitectura

| Fichero | Exportación | Responsabilidad |
|---------|-------------|-----------------|
| `rspack.config.ts` | `default(env)` | Punto de entrada; lee `mrpack.json` y `package.json` y devuelve el array de configuraciones |
| `configuracion.ts` | `default(config)` | Ensambla una `Configuration` completa de rspack para un bundle individual |
| `devtool.ts` | `Devtool(runtime, entornos, entorno)` | Calcula el valor de `devtool` (source maps) |
| `entry.ts` | `Entry(runtime, framework, config)` | Calcula los puntos de entrada según runtime y framework |
| `externals.ts` | `Externals(runtime, deps)` | Marca las dependencias como externas (solo Node) |
| `module.ts` | `Module(config)` | Configura los loaders (TS, CSS, SCSS, Pug, imágenes) |
| `optimization.ts` | `Optimization(runtime, desarrollo)` | Configura minificación y `splitChunks` |
| `output.ts` | `Output.build(runtime, config)` | Calcula el directorio y formato de los ficheros de salida |
| `plugins.ts` | `default(runtime, framework, config)` | Genera el array de plugins (`DefinePlugin`, `CssExtract`, `TsChecker`, `Manifest`) |
| `target.ts` | `Target(runtime)` | Devuelve el valor de `target` de rspack |

### Flujo de compilación

```
rspack.config.ts
  └─ configuracion()        ← un bundle por runtime declarado en mrpack.json
       ├─ Entry()           ← puntos de entrada
       ├─ Output.build()    ← directorio y nombres de fichero de salida
       ├─ Module()          ← loaders TypeScript/CSS/SCSS/Pug
       ├─ Optimization()    ← minificación y splitChunks
       ├─ Externals()       ← dependencias externas (solo Node)
       ├─ Devtool()         ← source maps
       ├─ Target()          ← plataforma destino
       └─ plugins()         ← DefinePlugin + CssExtract + TsChecker + Manifest
```

---

## Parches de migración (`mrpack:patch`)

**Ficheros:** `patches/`
**Documentación completa:** [`patches/README.md`](./patches/README.md)

> **Para agentes de IA:** cuando se te indique **"aplica los parches"**, ejecuta:
>
> ```bash
> yarn run patch:apply
> ```

El sistema de parches automatiza cambios repetitivos sobre todo el monorepo (sustitución
de imports deprecados, wrappers legacy, etc.). Se activa habitualmente tras
`yarn mrpack update`.

| Comando | Descripción |
|---------|-------------|
| `yarn run patch` | Analiza sin escribir en disco (exit 1 si hay pendientes) |
| `yarn run patch:apply` | Aplica todos los parches activos |

Los shorthands del `package.json` raíz mapean a:

| Shorthand | Comando completo |
|-----------|-----------------|
| `yarn run patch` | `yarn workspace @mr/core-dev mrpack:patch` |
| `yarn run patch:apply` | `yarn workspace @mr/core-dev mrpack:patch:apply` |

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.

