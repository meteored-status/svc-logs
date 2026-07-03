# CODEMAP — `@mr/core/dev/bundler/esbuild/`

> Importar/ejecutar vía: `node bundler/esbuild/esbuild.config.mjs --env entorno=<e> --env dir=<dir>`

---

## Árbol de directorios

```txt
bundler/esbuild/
└── esbuild.config.mjs   Entry point de esbuild para workspaces
```

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
- `getDefine({...})` — define variables globales (`DESARROLLO`, `TEST`, etc.).
- `getOptions(config)` — traduce config de bundle a opciones de `esbuild`.
- `getDatabase(build, entorno)` — selecciona BD de `build.database`.
- `getConfigList({...})` — genera una única config Node; para `runtime!=node` o `framework=nextjs` devuelve `[]` con warning.

### Ejecución

- `run()`:
  1. Lee `entorno` y `dir`.
  2. Carga `package.json` + `mrpack.json`.
  3. Construye opciones de build.
  4. En watch: arranca `tsc --watch` + `context(...).watch()`.
  5. En test/producción: limpia `output/`, ejecuta `build(...)` y `tsc --noEmit` en paralelo.

---

## Contrato funcional (equivalente a rspack)

- Soporta solo compilación Node.
- Solo compila cuando `deploy.runtime === "node"` y `build.framework !== "nextjs"`.
- Inyecta el mismo set de globales usado por rspack.
- Mantiene modo watch en desarrollo.
