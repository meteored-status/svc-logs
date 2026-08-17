# `@mr/core-dev`

Paquete de infraestructura de desarrollo compartida por todos los workspaces del monorepo.
Proporciona los **tipos globales de entorno**, las **configuraciones TypeScript base** (Node y browser)
y el **modelo de manifiesto** (`mrpack.json`) que describe cómo se compila y despliega cada workspace.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Variables globales](#variables-globales-de-entorno) | `@mr/core-dev/types` | Tipos globales inyectados por el bundler (`PRODUCCION`, `ENTORNO`, …) |
| [tsconfig · Node](#tsconfig--node) | `@mr/core-dev/tsconfig.json` (condición `node`) | Configuración TypeScript para servicios Node.js |
| [tsconfig · Browser](#tsconfig--browser) | `@mr/core-dev/tsconfig.json` (condición `browser`) | Configuración TypeScript para bundles de navegador |
| [Manifest](#manifest-mrpackjson) | `@mr/core-dev/manifest` | Modelo de datos del archivo `mrpack.json` |
| [Bundler rspack](#bundler-rspack) | `bundler/rspack/rspack.config.ts` | Configuración rspack compartida por todos los workspaces |
| [Bundler esbuild](#bundler-esbuild) | `bundler/esbuild/esbuild.config.mjs` | Configuración esbuild compartida por todos los workspaces |
| [Parches de migración](#parches-de-migración-mrpackpatch) | — | Autofix de imports deprecados; se aplica tras `yarn mrpack update` |
| [CONTRIBUTING.md](#contributingmd) | `CONTRIBUTING.md` | Convenciones de ramas (git-flow), versionado y despliegue (Cloud Build) del monorepo |
| [Hook CODEMAP/CHANGELOG](#hook-de-mantenimiento-codemapchangelog-claude-code) | `.claude/settings.json` | Hook `Stop` de Claude Code que fuerza mantener CODEMAP.md/CHANGELOG.md al día |

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
**Código fuente:** [`manifest/CODEMAP.md`](./manifest/CODEMAP.md) — mapa de clases, interfaces y jerarquía de composición

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
| `@mr/core-dev/manifest/build` | `ManifestBuild`, `IManifestBuild`, `BuildFW`, `BuildBundler` |
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
**Código fuente:** [`bundler/rspack/CODEMAP.md`](./bundler/rspack/CODEMAP.md) — entry point, ensamblador, todos los módulos (entry/output/devtool/module/plugins/externals/optimization/target) y flujo completo

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

## Bundler esbuild

**Ficheros:** `bundler/esbuild/`
**Documentación completa:** [`bundler/esbuild/README.md`](./bundler/esbuild/README.md)
**Código fuente:** [`bundler/esbuild/CODEMAP.md`](./bundler/esbuild/CODEMAP.md) — entry point, parseo de `--env`, normalización de `mrpack.json` y flujo build/watch

Módulo que genera la configuración de esbuild para workspaces del monorepo.
Versión Node-only:

- solo compila cuando `deploy.runtime === "node"`,
- no compila workspaces `build.framework === "nextjs"`,
- build única `app -> main.ts`,
- inyección de globales (`DESARROLLO`, `TEST`, `PRODUCCION`, `ENTORNO`, `NEXTJS`, `DATABASE`),
- watch en desarrollo y build única en `test/produccion`.

---

## Parches de migración (`mrpack:patch:apply`)

**Ficheros:** `patches/`
**Documentación completa:** [`patches/README.md`](./patches/README.md)
**Código fuente:** [`patches/CODEMAP.md`](./patches/CODEMAP.md) — runner, factorías, tabla de reglas R001–R020 y WS001

> **Para agentes de IA:** cuando se te indique **"aplica los parches"**, ejecuta:
>
> ```bash
> yarn run patch:apply
> ```

El sistema de parches automatiza cambios repetitivos sobre todo el monorepo (sustitución
de imports deprecados, wrappers legacy, etc.).

`yarn run patch:apply` se ejecuta **automáticamente** después de instalar, actualizar
o resetear frameworks mediante `yarn mrpack framework` o `yarn mrpack update`, por lo
que normalmente no es necesario invocarlo a mano. La salida se muestra en consola en
tiempo real durante su ejecución.

| Comando | Descripción |
|---------|-------------|
| `yarn run patch:apply` | Aplica todos los parches activos (incremental desde el último aplicado) |

Los shorthands del `package.json` raíz mapean a:

| Shorthand | Comando completo |
|-----------|-----------------|
| `yarn run patch:apply` | `yarn workspace @mr/core-dev mrpack:patch:apply` |

---

## CONTRIBUTING.md

**Fichero:** `CONTRIBUTING.md`
**Expuesto en la raíz de cada monorepo consumidor** mediante symlink (`initContributing()`,
mismo patrón que `AGENTS.md`/`CLAUDE.md` — ver `@mr/cli/src/mrpack/clases/init/symlinks.ts`).

Documenta las convenciones de ramas (git-flow del monorepo: `master`/`main`, `develop`,
`hotfix/<nombre>`, `feature/<fecha>_<nombre>_<ticket>_<desc>`, `version/<desarrollador>`),
versionado (paquetes de negocio vs. de framework) y despliegue (Google Cloud Build
disparado por push a `develop`/`feature/test`/`master`).

Enlazado desde `CLAUDE.md` (import `@CONTRIBUTING.md`) y desde
`.github/copilot-instructions.md`, ambos resueltos desde la raíz del repo consumidor.

---

## Hook de mantenimiento CODEMAP/CHANGELOG (Claude Code)

**Ficheros:** `.claude/`
**Código fuente:** [`.claude/CODEMAP.md`](./.claude/CODEMAP.md) — flujo completo del script del hook

Hook `Stop` de Claude Code que hace cumplir de forma determinista la convención de
"Mantenimiento de CODEMAPs" (ver `.github/copilot-instructions.md`/`AGENTS.md`): al terminar un
turno con cambios en el working tree, agrupa los ficheros de código modificados por workspace
(directorio con `package.json` más cercano, excluyendo la raíz del monorepo) y bloquea una vez
si algún workspace con cambios significativos (fichero nuevo, o ≥ 15 líneas modificadas) no
tocó su `CODEMAP.md` — o su `CHANGELOG.md`, si ya existía.

- Todo `.claude/` se symlinkea entero en la raíz de cada monorepo consumidor mediante
  `initClaudeDir()` (`@mr/cli/src/mrpack/clases/init/symlinks.ts`), igual que `.github/`
  (junction en Windows, symlink relativo en Unix) — a diferencia de `AGENTS.md`/`CLAUDE.md`,
  que son symlinks de fichero simple. `.claude/settings.local.json` (local) se excluye tanto
  del envío del framework (`.claude/.mr-ignore`) como del `.gitignore` raíz de cada monorepo
  consumidor (`**/.claude/settings.local.json` en la plantilla `IGNORE` de `@mr/cli`); si ya
  existía como fichero real antes de tener este framework, `initClaudeDir()` lo migra primero a
  `@mr/core/dev/.claude/` para no perderlo.
- `.claude/settings.json` — declara el hook.
- `.claude/hooks/check-codemap.mjs` — Node ESM plano sin dependencias, invocado siempre como
  `node check-codemap.mjs` (el bit ejecutable es irrelevante).

Solo analiza cambios sin comitear, y por el guardrail `stop_hook_active` de Claude Code el
bloqueo ocurre como máximo una vez por intento de parada (evita bucles infinitos).

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.
