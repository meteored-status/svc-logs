# CODEMAP — `@mr/core-dev`

> Segmentado por bloques. Los bloques que ya tienen `CODEMAP.md` propio (`manifest/`,
> `bundler/rspack/`, `bundler/esbuild/`, `patches/`, `.claude/`) no se duplican aquí: se
> resume su tabla de ficheros/símbolos y se enlaza al `README.md`/`CODEMAP.md` de detalle.
> Los bloques sin sub-CODEMAP (tipos globales, tsconfigs) se documentan completos en este fichero.

---

## 1. Raíz — tipos globales de entorno (`types.d.ts` / `types.ts`)

**README:** [`README.md`](./README.md#variables-globales-de-entorno)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `types.d.ts` | `PRODUCCION`, `TEST`, `DESARROLLO`, `NEXTJS`, `ENTORNO`, `DATABASE` (todas `declare var`) |
| `types.ts` | ninguno — solo `/// <reference path="./types.d.ts" />`; entrada del subpath `@mr/core-dev/types` |

### Símbolos

#### Variables globales (`declare var`)

Inyectadas como **literales** por el `DefinePlugin` de `bundler/rspack/plugins.ts` (o el
`getDefine()` de `bundler/esbuild/esbuild.config.mjs`); no existen en runtime, el bundler
sustituye cada referencia por su valor antes de emitir el bundle (tree-shaking total).

```
PRODUCCION: boolean          — true en producción Y en test/staging (ver combinaciones)
TEST:       boolean          — true solo en test/staging; implica PRODUCCION=true
DESARROLLO: boolean          — true en modo desarrollo local; excluyente con PRODUCCION
NEXTJS:     boolean          — true si el runtime activo es Next.js
ENTORNO:    string           — "produccion" | "test" | "desarrollo" | ...
DATABASE:   string|undefined — nombre de BD activa (build.database del mrpack.json); undefined si no aplica
```

| Entorno real | `PRODUCCION` | `TEST` | `DESARROLLO` |
|---|:---:|:---:|:---:|
| Producción | `true` | `false` | `false` |
| Test / staging | `true` | `true` | `false` |
| Desarrollo local | `false` | `false` | `true` |

**Disponibilidad:** los tsconfigs `tsconfig/node.json` y `tsconfig/browser.json` incluyen
`"@mr/core-dev"` en `compilerOptions.types`, por lo que cualquier workspace que extienda
(directa o transitivamente) estos tsconfigs recibe las variables sin `import`. Un workspace con
tsconfig propio que no extienda de aquí debe añadir `"@mr/core-dev"` a su array `types`, o
importar explícitamente `@mr/core-dev/types`.

**Depende de:** nada — son declaraciones ambiente puras.
**Usado por:** cualquier código de negocio que ramifique por entorno (`if (PRODUCCION) {...}`);
inyectadas por `bundler/rspack/plugins.ts` (`rspack.DefinePlugin`) y
`bundler/esbuild/esbuild.config.mjs` (`getDefine()`).

---

## 2. tsconfig · Node — `tsconfig.json` / `tsconfig/node.json`

**README:** [`README.md`](./README.md#tsconfig--node)
**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `tsconfig.json` | Extiende `./tsconfig/node.json`; añade `allowImportingTsExtensions`. Resuelto por defecto (condición de exportación `default`) para consumidores que no distinguen `node`/`browser` |
| `tsconfig/node.json` | Configuración base real para servicios Node.js; extiende `@tsconfig/node24/tsconfig.json` |

### Opciones destacadas (`tsconfig/node.json`)

```
module: "preserve"              moduleResolution: "bundler"
lib: ["es2023", "esnext.disposable", "dom"]      types: ["node", "@mr/core-dev"]
jsx: "react"                    strictNullChecks: true
noImplicitOverride: true        noImplicitReturns: true
noPropertyAccessFromIndexSignature: true         incremental: true
removeComments: true            sourceMap: true
exclude: ["node_modules", "**/*.spec.ts", "output/*", "output/**/*"]
```

**Depende de:** `@tsconfig/node24` (paquete público).
**Usado por:** todo workspace `runtime: node` (ver `manifest/deployment` → `Runtime.node`) vía:

```jsonc
// tsconfig.json de cualquier servicio Node
{ "extends": "@mr/core-dev/tsconfig.json" }  // resuelve a tsconfig/node.json por la condición "node" de package.json#exports
```

---

## 3. tsconfig · Browser — `tsconfig/browser.json`

**README:** [`README.md`](./README.md#tsconfig--browser)
**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `tsconfig/browser.json` | Configuración base para bundles de navegador; extiende `@tsconfig/recommended/tsconfig.json` |

### Opciones destacadas

```
target: "es2015"                module: "esnext"
moduleResolution: "bundler"     lib: ["es2015", "dom"]
allowJs: true                   downlevelIteration: true
removeComments: false           types: ["@mr/core-dev"]
strictNullChecks: true          noImplicitAny: true
sourceMap: true
```

**Depende de:** `@tsconfig/recommended` (paquete público).
**Usado por:** todo workspace/bundle `runtime: browser` (build principal o cada entrada de
`manifest.build.bundle.web[]`), resuelto vía la condición de exportación `browser`:

```jsonc
{ "extends": "@mr/core-dev/tsconfig.json" }  // resuelve a tsconfig/browser.json bajo condición "browser"
```

---

## 4. Manifest (`mrpack.json`) — `manifest/`

**README:** [`manifest/README.md`](./manifest/README.md)
**Código fuente:** [`manifest/CODEMAP.md`](./manifest/CODEMAP.md) — árbol completo de clases/interfaces y jerarquía de composición
**Ficheros (raíz del bloque):**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `manifest/index.ts` | `IManifest`, `Manifest` |
| `manifest/root.ts` | `ManifestRoot<T>` (clase base abstracta) |
| `manifest/development.ts` | `IManifestDevelopment`, `ManifestDevelopment` |
| `manifest/build/index.ts` | `IManifestBuild`, `ManifestBuild`, `BuildFW`, `BuildBundler` |
| `manifest/build/database.ts` | `IManifestBuildDatabase`, `ManifestBuildDatabase` |
| `manifest/build/bundle/index.ts` | `IManifestBuildBundle`, `ManifestBuildBundle` |
| `manifest/build/bundle/base.ts` | `IManifestBuildBundleBase`, `ManifestBuildBundleBase` |
| `manifest/build/bundle/componentes.ts` | `IManifestBuildComponentes`, `ManifestBuildComponentes`, `ManifestBuildComponentesCSS` |
| `manifest/deployment/index.ts` | `IManifestDeployment`, `ManifestDeployment`, `Runtime`, `Target`, `ManifestDeploymentKind` |
| `manifest/deployment/annotations.ts` | `IManifestDeploymentAnnotations`, `ManifestDeploymentAnnotations` |
| `manifest/deployment/credenciales.ts` | `IManifestDeploymentCredenciales`, `ManifestDeploymentCredenciales` |
| `manifest/deployment/imagen/index.ts` + `entorno.ts` | `IManifestDeploymentImagen(Entorno)`, `ManifestDeploymentImagen(Entorno)` |
| `manifest/deployment/kustomize/index.ts` | `IManifestDeploymentKustomize`, `ManifestDeploymentKustomize` |
| `manifest/deployment/lambda/index.ts` | `IManifestDeploymentLambda`, `ManifestDeploymentLambda`, `Egress`, `Ingress` |
| `manifest/deployment/storage/index.ts` + `buckets.ts` | `IManifestDeploymentStorage(Buckets)`, `ManifestDeploymentStorage(Buckets)` |

### Símbolos (resumen — detalle completo en `manifest/CODEMAP.md`)

#### `Manifest` / `IManifest`
Modelo raíz del `mrpack.json` de cada workspace: `{enabled, deploy, devel, build}`. Cada nodo
sigue el patrón `static build(pojo)` (factory tolerante a opcionales) + `toJSON()`
(serialización de vuelta, omitiendo defaults).

```ts
import type {IManifest} from "@mr/core-dev/manifest";
import {Manifest} from "@mr/core-dev/manifest";

const manifest = new Manifest(JSON.parse(fs.readFileSync("mrpack.json", "utf8")));
```

#### `BuildFW` / `BuildBundler` / `Runtime` / `Target` / `ManifestDeploymentKind`
Enums de valores (`const` con propiedades readonly, no `enum` TS) que clasifican el workspace:
framework de compilación (`meteored`/`nextjs`), bundler efectivo (`rspack`/`esbuild`/`none`),
runtime de ejecución (`node`/`browser`/`cfworker`/`php`), infraestructura destino
(`k8s`/`lambda`/`none`) y tipo de recurso K8s (`service`/`cronjob`/`job`/`browser`/`worker`).

**Depende de:** `manifest/root.ts` (`ManifestRoot<T>`) como base de todos los nodos.
**Usado por:** `@mr/cli` (`mrpack`) para leer/validar/escribir `mrpack.json` de cada workspace
(compilación, despliegue, `devel`); `bundler/rspack/rspack.config.ts` y
`bundler/esbuild/esbuild.config.mjs` (leen `Manifest` para decidir `runtime`, `framework`,
`bundle`, `database`).

---

## 5. Bundler rspack — `bundler/rspack/`

**README:** [`bundler/rspack/README.md`](./bundler/rspack/README.md)
**Código fuente:** [`bundler/rspack/CODEMAP.md`](./bundler/rspack/CODEMAP.md) — entry point, ensamblador, todos los módulos (`entry`/`output`/`devtool`/`module`/`plugins`/`externals`/`optimization`/`target`) y flujo completo
**Ficheros:**

| Fichero | Exportación |
|---------|-------------|
| `bundler/rspack/rspack.config.ts` | `default(env)` — entry point invocado por rspack |
| `bundler/rspack/configuracion.ts` | `default(config)` — ensambla la `Configuration` de un bundle |
| `bundler/rspack/entry.ts`, `output.ts`, `devtool.ts`, `module.ts`, `optimization.ts`, `externals.ts`, `target.ts`, `plugins.ts` | una función/clase por aspecto de la `Configuration` de rspack |

### Símbolos (resumen)

```
rspack.config.ts (default export)
  ← lee mrpack.json + package.json del workspace → Manifest
  → configuracion() por bundle: principal (manifest.deploy.runtime) + uno por manifest.build.bundle.web[]
```

Cada bundle se ensambla combinando `Entry()`, `Output.build()`, `Module()`, `plugins()`,
`Externals()`, `Devtool()`, `Target()`, `Optimization()` — ver `bundler/rspack/CODEMAP.md` para
la firma exacta de cada función y la tabla de comportamiento por `runtime`.

**Depende de:** `manifest/` (`Manifest`, `BuildFW`, `Runtime`, `ManifestBuildBundleBase`) para
leer la configuración del workspace; inyecta las variables de `types.d.ts` vía `DefinePlugin`.
**Usado por:** cada workspace vía su propio `rspack.config.ts`:

```ts
export {default} from "@mr/core-dev/bundler/rspack/rspack.config";
```

Invocación real (por `mrpack devel`/`packd`):
```
rspack --env entorno=<e> --env dir=<dir> [--env watch=true] --config bundler/rspack/rspack.config.ts
```

---

## 6. Bundler esbuild — `bundler/esbuild/`

**README:** [`bundler/esbuild/README.md`](./bundler/esbuild/README.md)
**Código fuente:** [`bundler/esbuild/CODEMAP.md`](./bundler/esbuild/CODEMAP.md) — entry point, parseo de `--env`, normalización de `mrpack.json` y flujo build/watch
**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `bundler/esbuild/esbuild.config.mjs` | Entry point único; alternativa Node-only a rspack |

### Símbolos (resumen)

Contrato equivalente a rspack pero restringido:
- solo compila si `deploy.runtime === "node"` y `build.framework !== "nextjs"`,
- build única `app -> main.ts`, sin bundles `web[]`,
- inyecta el mismo set de globales (`DESARROLLO`/`TEST`/`PRODUCCION`/`ENTORNO`/`NEXTJS`/`DATABASE`),
- `--watch` es opt-in explícito (no se activa solo por `entorno=desarrollo`).

**Depende de:** `manifest/` (misma lectura de `mrpack.json` que rspack, normalizada con
`normalizeBuild()`).
**Usado por:** workspaces `runtime: node` cuyo `mrpack.json` declare `build.bundler: "esbuild"`;
invocado como `node bundler/esbuild/esbuild.config.mjs --env entorno=<e> --env dir=<dir>`.

---

## 7. Parches de migración — `patches/`

**README:** [`patches/README.md`](./patches/README.md)
**Código fuente:** [`patches/CODEMAP.md`](./patches/CODEMAP.md) — runner, factorías de reglas y tabla completa R001–R034 + WS001
**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `patches/index.mjs` | Runner — recorre el monorepo y aplica `RULES`/`WORKSPACE_RULES` desde el cursor guardado en `config.workspaces.json` |
| `patches/rule-factory.mjs` | Factorías reutilizables (`createSimpleRule`, `createLineRegexRule`, `createSplitRule`, `createWorkspaceRule`) |
| `patches/rules/*.mjs` | Una regla por fichero — sustituciones de imports deprecados y renombrados breaking |

### Símbolos (resumen)

Cada regla de fichero implementa `{id, summary, apply(content, filePath?)}`; cada regla de
workspace implementa `{id, summary, type: "workspace", run(rootDir)}`. El runner es idempotente
e incremental: solo aplica reglas con número mayor que el cursor `framework.patch` de
`config.workspaces.json`.

**Depende de:** ninguna dependencia interna de `@mr/core-dev` — opera sobre el árbol de ficheros
`.ts`/`.tsx`/`.js`/`.mjs`/`.cjs` de todo el monorepo consumidor.
**Usado por:** `yarn run patch:apply` (alias de `yarn workspace @mr/core-dev mrpack:patch:apply`);
invocado automáticamente por `@mr/cli` (`aplicarPatches()` en
`@mr/cli/src/mrpack/clases/patches.ts`) tras `mrpack framework`/`mrpack update`, siempre antes
de recompilar `@mr/cli`.

---

## 8. Hook de mantenimiento CODEMAP/CHANGELOG (Claude Code) — `.claude/`

**Código fuente:** [`.claude/CODEMAP.md`](./.claude/CODEMAP.md) — flujo completo del script del hook (no tiene `README.md` propio; documentado inline en [`README.md`](./README.md#hook-de-mantenimiento-codemapchangelog-claude-code))
**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `.claude/settings.json` | Declara el hook `Stop` → `hooks/check-codemap.mjs` |
| `.claude/hooks/check-codemap.mjs` | Node ESM sin dependencias; hace cumplir la convención de mantener `CODEMAP.md`/`CHANGELOG.md` al día |
| `.claude/.mr-ignore` | Excluye `settings.local.json` del envío del framework (`mrpack framework --send`) |

### Símbolos (resumen)

Sin exports TS — es un hook de proceso. `check-codemap.mjs::main()` lee el evento `Stop` desde
stdin, agrupa por workspace los ficheros de código sin comitear, y bloquea una vez (guardrail
`stop_hook_active`) si algún workspace con cambios significativos no tocó su `CODEMAP.md`
(o `CHANGELOG.md`, si ya existía). Ver `.claude/CODEMAP.md` para el detalle de cada paso.

**Depende de:** nada de `@mr/core-dev` en tiempo de ejecución — es un script de proceso invocado
por el propio Claude Code.
**Usado por:** todo monorepo consumidor, vía `initClaudeDir()`
(`@mr/cli/src/mrpack/clases/init/symlinks.ts`), que symlinkea `.claude/` entero en la raíz del
proyecto (mismo mecanismo que `initGithub()` con `.github/`).

---

## Diagrama de dependencias entre bloques

```
                         ┌───────────────────────────────┐
                         │  workspace cualquiera          │
                         │  (services/*, packages/*, ...) │
                         └───────────────┬───────────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │ tsconfig.json      │ mrpack.json         │ .claude/, .github/, AGENTS.md,
                    │ "extends"          │ (raíz del workspace) │ CLAUDE.md (symlinks vía mrpack init)
                    ▼                    ▼                     ▼
      ┌─────────────────────────┐  ┌───────────┐        .claude/CODEMAP.md
      │ tsconfig/node.json      │  │ manifest/ │        (hook Stop check-codemap.mjs)
      │ tsconfig/browser.json   │  │ (Manifest)│
      │  types: ["@mr/core-dev"]│  └─────┬─────┘
      └────────────┬─────────────┘        │
                   │ inyecta                │ leído por
                   ▼                       ▼
            types.d.ts (PRODUCCION,   ┌───────────────────┬────────────────────┐
            TEST, DESARROLLO,         ▼                    ▼                    │
            NEXTJS, ENTORNO,   bundler/rspack/      bundler/esbuild/            │
            DATABASE)          (runtime browser,    (runtime node,             │
                   ▲            o node+rspack)        sin next.js)             │
                   │                   │                    │                  │
                   └── DefinePlugin ───┴──── getDefine() ───┘                  │
                                       │                                       │
                                       ▼                                       │
                                  output/ (bundle compilado)                   │
                                                                                │
   patches/ (yarn run patch:apply) ── recorre .ts/.js/.mjs/.cjs del monorepo ──┘
   independiente del ciclo de build; se aplica tras `mrpack framework`/`mrpack update`
```

**Regla de dependencia:** los tsconfigs y `types.d.ts` son la base que todo workspace consume
directamente; `manifest/` es el modelo de datos leído tanto por `@mr/cli` (mrpack) como por
ambos bundlers; `patches/` y `.claude/` operan a nivel de monorepo/proceso y son independientes
del grafo de compilación.
