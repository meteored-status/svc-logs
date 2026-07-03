# CODEMAP — `@mr/core/dev/bundler/rspack/`

> Generado: 2026-06-15. Actualizar tras cambios en la configuración de rspack.
> Importar vía: `yarn workspace @mr/core-dev rspack --env entorno=<e> --env dir=<dir> --config bundler/rspack/rspack.config.ts`

---

## Árbol de directorios

```
bundler/rspack/
├── rspack.config.ts   Entry point — lee mrpack.json y delega en configuracion()
├── configuracion.ts   Ensambla la Configuration completa de rspack para un bundle
├── devtool.ts         Devtool() — decide la estrategia de source maps
├── entry.ts           Entry() — construye los puntos de entrada
├── externals.ts       Externals() — marca deps como externas (node) o las empaqueta (browser)
├── module.ts          Module() — configura los loaders (TS/SCSS/CSS/Pug/assets)
├── optimization.ts    Optimization() — split chunks y minificación
├── output.ts          Output — clase que define directorio y nombre de ficheros de salida
├── plugins.ts         plugins() — DefinePlugin, TsChecker, CssExtract, ManifestPlugin
├── target.ts          Target() — target de rspack según runtime
└── tsconfig.json      tsconfig local del bundler
```

---

## `rspack.config.ts` — Entry point

```ts
export function isFileSync(file: PathLike): boolean
export function readJSONSync<T>(file: PathOrFileDescriptor): T | null

// Export por defecto — función llamada por rspack
export default (env: IEnv) => Configuration[]
```

**Flujo:**
1. Sanitiza `env.dir` (elimina comillas dobles que rspack puede inyectar por CLI).
2. Lee `package.json` y `mrpack.json` del workspace; construye `Manifest`.
3. Detecta `rules.js` opcional en la raíz del workspace.
4. Devuelve un array de configuraciones:
   - **[0]** bundle principal: `configuracion({ runtime: manifest.deploy.runtime, ... })`
   - **[1..N]** bundles web: uno por cada `manifest.build.bundle.web[]`, forzando `runtime: Runtime.browser`

**Variables de entorno recibidas:**
```
IEnv { entorno: string; dir: string; }
```

---

## `configuracion.ts` — Ensamblador principal

```ts
interface IConfiguracionConfig {
    basedir:      string;
    bundle:       ManifestBuildBundleBase;
    dependencies: Record<string, string>;
    entorno:      string;
    framework:    BuildFW;
    runtime:      Runtime;
    database?:    string;         // BD activa para el entorno
    rules?:       string;         // ruta a rules.js del workspace
}

export default (config: IConfiguracionConfig): Configuration
```

**Lógica de entorno:**
- `desarrollo = !["produccion","test"].includes(entorno)` → activa watch, desactiva minificación
- `test = ["desarrollo","test"].includes(entorno)` → activa source maps de CSS

**Modo `watch` (solo desarrollo):**
```
aggregateTimeout: 1000
ignored: .yarn, @mr/cli, assets, files, mapping, output (en todos los niveles)
```

**Campos de la `Configuration` ensamblada:**

| Campo | Módulo |
|-------|--------|
| `entry` | `Entry(runtime, framework, { basedir, entries })` |
| `output` | `Output.build(runtime, { basedir, desarrollo, cssCritico })` |
| `mode` | `"development"` / `"production"` |
| `optimization` | `Optimization(runtime, desarrollo)` si `optimizar`, else `{}` |
| `devtool` | `Devtool(runtime, source_map, entorno)` |
| `module` | `Module({ componentes, desarrollo, test, rules })` |
| `plugins` | `plugins(runtime, framework, { basedir, entorno, desarrollo, database, prefix, css })` |
| `externals` | `Externals(runtime, dependencies)` |
| `target` | `Target(runtime)` |
| `resolve.extensions` | `[".ts", ".js", ".tsx", ".jsx"]` |
| `resolve.extensionAlias` | `.js→[.js,.ts]`, `.cjs→[.cjs,.cts]`, `.mjs→[.mjs,.mts]` |
| `stats` | `"minimal"` |

---

## `entry.ts`

```ts
export function Entry(runtime: Runtime, framework: BuildFW, config: IEntryConfig): TEntry
```

| Runtime | Framework | Comportamiento |
|---------|-----------|----------------|
| `node` | `meteored` | `{ app: "${basedir}/main.ts" }` |
| `node` | `nextjs` | `{}` — Next.js gestiona el bundling |
| `browser` | cualquiera | `bundle.entries` — rutas absolutas/relativas respecto a `basedir`; nombres de módulo via `require.resolve` |

---

## `output.ts`

```ts
export class Output implements TOutput {
    public readonly uniqueName:    string   // basename(basedir)
    public readonly path:          string   // ruta absoluta al directorio de salida
    public readonly filename:      Filename
    public readonly chunkFilename?: Filename
    public readonly clean:         boolean

    public constructor(filename, basedir, output, clean, chunkFilename?)
    public static build(runtime: Runtime, config: IOutputConfig): Output
}
```

| Runtime | Directorio | Filename (dev) | Filename (prod) | `clean` |
|---------|------------|----------------|-----------------|---------|
| `node` | `output/` | `[name].js` | `[name].js` | `false` |
| `browser` (normal) | `output/bundle/` | `[name].js` | `[name]/[contenthash].js` | `true` |
| `browser` (critical) | `output/critical/` | `[name].js` | `[name]/[contenthash].js` | `true` |

> `cssCritico = true` cuando `bundle.componentes.css === ManifestBuildComponentesCSS.CRITICAL`.

---

## `target.ts`

```ts
export function Target(runtime: Runtime): TTarget
// node    → "node"
// browser → ["web", "es5"]
```

---

## `devtool.ts`

```ts
export function Devtool(runtime: Runtime, entornos: string[], entorno: string): TSourceMap
// node    → siempre "source-map"
// browser → "source-map" si entorno ∈ entornos, else false
// resto   → false
```

> `entornos` viene de `bundle.source_map ?? ["desarrollo", "test"]` en `configuracion.ts`.

---

## `externals.ts`

```ts
export function Externals(runtime: Runtime, dependencies?: Record<string,string>): TExternals
// node    → buildNode(dependencies)  — todas las deps como commonjs/module externas
// browser → {}                       — nada externo, todo se empaqueta
```

**`buildNode`:** Itera las `dependencies`. Las que aparecen en `ES_MODULES` con la major correcta se marcan como `module <mod>`; el resto como `commonjs <mod>`. Añade además una función de externals que resuelve sub-paths (ej. `formidable/src/...`).

**Paquetes ESM conocidos** (marcados como `module`):

| Paquete | Major ESM |
|---------|-----------|
| `@inquirer/prompts` | 8 |
| `chokidar` | 5 |
| `formidable` | 3 |
| `mime` | 4 |
| `pdf-merger-js` | 5 |
| `uuid` | 13 |

> Los paquetes `@mr/*` siempre se omiten de externals (se resuelven internamente).

---

## `optimization.ts`

```ts
export function Optimization(runtime: Runtime, desarrollo: boolean): TOptimization
```

| Runtime | `concatenateModules` | `minimize` | `splitChunks` |
|---------|:--------------------:|:----------:|:-------------:|
| `node` | `false` | `!desarrollo` | — |
| `browser` | `true` | `!desarrollo` | vendor chunk (`node_modules`) |

> `Optimization` solo se aplica si `bundle.componentes.optimizar === true`. Si es `false`, se pasa `{}`.

---

## `module.ts`

```ts
interface IModuleConfig {
    componentes: ManifestBuildComponentes;
    desarrollo:  boolean;
    test:        boolean;
    rules?:      string;    // ruta a rules.js del workspace
}

export function Module(config: IModuleConfig): ModuleOptions
```

**Loaders configurados** (en orden):

| Condición | Loader(s) | Configuración relevante |
|-----------|-----------|-------------------------|
| `componentes.pug === true` | `pug3-loader` | `pretty: desarrollo` |
| CSS activo: imágenes/fuentes | `asset/inline` (critical) o `asset/resource` | test: `png|jpg|gif|svg|eot|ttf|woff` |
| CSS activo: `.css` | `css-loader` + `style-loader` (inyectado) o `CssExtractRspackPlugin.loader` | `sourceMap: test` |
| CSS activo: `.scss/.sass` | `sass-loader` (dart-sass, modern-compiler) + `css-loader` + output loader | `outputStyle: compressed` en prod/critical; `to-string-loader` si CSS=STRING |
| Siempre: `.ts/.tsx/.mts/.cts` | `builtin:swc-loader` (integrado en rspack) | decorators + decoratorMetadata |
| `rules !== undefined` | reglas del workspace vía `require(rules)` | — |

---

## `plugins.ts`

```ts
export default (runtime: Runtime, framework: BuildFW, config: IPluginsConfig): TPlugins
```

**Plugins siempre incluidos:**
- `rspack.DefinePlugin` — inyecta globales:

| Variable | Valor |
|----------|-------|
| `DESARROLLO` / `global.DESARROLLO` | `entorno === "desarrollo"` |
| `TEST` / `global.TEST` | `entorno === "test"` |
| `PRODUCCION` / `global.PRODUCCION` | `!desarrollo` |
| `ENTORNO` / `global.ENTORNO` | `entorno` (string) |
| `NEXTJS` / `global.NEXTJS` | `framework === BuildFW.nextjs` |
| `DATABASE` / `global.DATABASE` | nombre de BD del entorno |

**Plugins condicionales:**
- `TsCheckerRspackPlugin` — solo la primera vez (flag `tsCheckerRegistered`); apunta a `${basedir}/tsconfig.json`.
- `RspackManifestPlugin` → genera `output/bundle/stats.json` con `_` (todos los ficheros) y `<entry>.js` (URLs públicas). Solo en `runtime === browser`.
- `CssExtractRspackPlugin` — cuando `css === true`; emite `[name].css`.

---

## Flujo completo de compilación

```
rspack --env entorno=desarrollo --env dir=/abs/path --config bundler/rspack/rspack.config.ts
  │
  └─▶ rspack.config.ts (default export)
        ├── readJSONSync(mrpack.json) → Manifest
        ├── readJSONSync(package.json) → dependencies
        └── [
              configuracion({ runtime: manifest.deploy.runtime, bundle: manifest.build.bundle, ... }),
              ...manifest.build.bundle.web.map(b => configuracion({ runtime: browser, bundle: b, ... }))
            ]
              │
              └─▶ configuracion.ts
                    ├── Entry()        → entry
                    ├── Output.build() → output
                    ├── Devtool()      → devtool
                    ├── Module()       → module.rules
                    ├── plugins()      → plugins
                    ├── Externals()    → externals
                    ├── Target()       → target
                    └── Optimization() → optimization
```

---

## Añadir un paquete ESM a la lista de externals

En `externals.ts`, añadir una entrada a `ES_MODULES`:
```ts
const ES_MODULES: Record<string, string> = {
    // ...
    "nuevo-paquete": "2",  // major que usa ESM nativo
};
```

## Añadir loaders personalizados en un workspace

Crear `rules.js` en la raíz del workspace:
```js
// rules.js
module.exports = [
    { test: /\.custom$/, use: ["custom-loader"] },
];
```
rspack lo detecta automáticamente via `isFileSync` en `rspack.config.ts`.

