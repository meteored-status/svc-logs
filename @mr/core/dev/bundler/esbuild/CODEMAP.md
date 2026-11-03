# CODEMAP — `@mr/core/dev/bundler/esbuild/`

> Importar/ejecutar vía: `node bundler/esbuild/esbuild.config.mjs --env entorno=<e> --env dir=<dir>`

---

## Árbol de directorios

```txt
bundler/esbuild/
├── define.mjs           getDefine(): los `define` (DESARROLLO, TEST, PRODUCCION, ENTORNO, NEXTJS, DATABASE)
└── esbuild.config.mjs   Entry point de esbuild para workspaces
```

## `define.mjs`

- `getDefine({entorno, database})` — mapa para la opción `define` de esbuild (`DESARROLLO`, `TEST`, `PRODUCCION`, `ENTORNO`,
  `NEXTJS`, `DATABASE` y sus versiones `global.*`). Vive aparte porque `esbuild.config.mjs` lanza su build al importarse: lo
  importan él y `pubsub/evaluar.mjs`, que empaqueta los `mrpack.pubsub.ts` con los mismos `define` que el build de desarrollo.

---

## `esbuild.config.mjs`

### Helpers de IO/CLI

- `isFileSync(file)` — comprueba existencia de fichero.
- `readJSONSync(file)` — lectura JSON tolerante a error.
- `parseEnv(argv)` — parsea flags `--env key=value`.
- `runTsc(basedir, watchMode)` — lanza `tsc --noEmit` (y `--watch` cuando aplica).

### Helpers de normalización

- `normalizeBuild(rawBuild)` — normaliza `build` para extraer framework/database.
- `getNodeEntries(basedir)` — entrada node (`app -> main.ts`).
- `getOutputConfig(basedir)` — salida fija `output/`.
- `getSourcemap()` — source maps siempre activos en Node.
- `getDefine({...})` — define variables globales (`DESARROLLO`, `TEST`, etc.). Se importa de `define.mjs`.
- `getOptions(config)` — traduce config de bundle a opciones de `esbuild`. Aquí sale `external: Object.keys(dependencies ?? {})`: **la lista de `dependencies` del workspace es su lista de externals**, así que declarar o no declarar un paquete decide si queda como `require()` o si se empaqueta dentro del `app.js`. Ver el README para las consecuencias y las dos trampas al auditar (el lanzador y `tslib`).
- `getDatabase(build, entorno)` — selecciona BD de `build.database`.
- `getConfigList({...})` — genera una única config Node; para `runtime!=node` o `framework=nextjs` devuelve `[]` con warning.

### Ejecución

- `run()`:
  1. Lee `entorno` y `dir`.
  2. Carga `package.json` + `mrpack.json`.
  3. Construye opciones de build.
  4. Con `--watch` (cualquier `entorno`): arranca `tsc --watch` + `context(...).watch()`.
  5. Sin `--watch` (incluido `entorno=desarrollo`): limpia `output/`, ejecuta `build(...)` y `tsc --noEmit` en paralelo, y termina.

---

## Contrato funcional (equivalente a rspack)

- Soporta solo compilación Node.
- Los externals **no** se configuran: son las `dependencies` del workspace.
- Solo compila cuando `deploy.runtime === "node"` y `build.framework !== "nextjs"`.
- Inyecta el mismo set de globales usado por rspack.
- El modo watch es opt-in vía `--watch`; ya no se activa automáticamente por `entorno=desarrollo`.
