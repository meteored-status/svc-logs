# CODEMAP — `@mr/cli`

> Generado: 2026-08-13. Actualizar tras cambios significativos.
> Segmentado por bloques, siguiendo el mismo formato que
> [`@mr/core-network/CODEMAP.md`](../core/network/CODEMAP.md): tabla "Fichero | Símbolos
> exportados", sección "Símbolos" con firmas resumidas, notas "Depende de"/"Usado por" y
> diagrama de dependencias entre bloques al final.
>
> Este fichero complementa a [`README.md`](./README.md) (uso, flags, flujos de trabajo de
> `mrpack`/`mrlang` en detalle) sin duplicarlo: aquí solo se documentan ficheros, símbolos
> exportados y relaciones de dependencia entre bloques. Consulta el README para el
> comportamiento funcional de cada comando.

`@mr/cli` es el CLI del monorepo `web-www`. Expone dos binarios (`package.json::bin`):

| Binario | Entry point | Submódulo (documentación detallada) |
|---------|-------------|--------------------------------------|
| `mrpack` | `bin/mrpack.js` → `src/mrpack/main.ts` | [`src/mrpack/CODEMAP.md`](./src/mrpack/CODEMAP.md) |
| `mrlang` | `bin/mrlang.js` → `src/mrlang/main.ts` | [`src/mrlang/CODEMAP.md`](./src/mrlang/CODEMAP.md) |

---

## 1. Raíz del paquete — `bin/`

**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `bin/mrpack.js` | Entry point ejecutable de `mrpack`. Fija `MRPACK_ROOT` (raíz del monorepo, calculada desde `__dirname`, no `process.cwd()`) y delega en `lib.js` |
| `bin/mrlang.js` | Idéntico a `mrpack.js` pero para `mrlang` |
| `bin/lib.js` | Lógica compartida de arranque (sin TypeScript, plano en JS) |
| `bin/min/*.js` | **Artefactos compilados** (`mrpack-run.js`, `mrlang-run.js` + `.js.map`); no editar a mano, ver [§7](#7-compilación-del-paquete) |

### Símbolos

#### `lib.js` (`module.exports`)
```js
module.exports = (modulo: "mrpack"|"mrlang") => void
```
Flujo: normaliza `MRPACK_ROOT` (fallback a `process.cwd()` si el bin no lo fijó), hace
`chdir` a la raíz de `@mr/cli`, y ejecuta `Modulo.ejecutar()`:
- Intenta `require("./min/<modulo>-run")` directamente.
- Si falla (artefacto ausente o corrupto), compila (`yarn run compile`, vía `spawn`) y
  reintenta una vez.
- Suprime los warnings de proceso `DEP0040` (paquete `punycode` deprecado, arrastrado por
  `dd-trace`/`@google-cloud/storage` vía `node-fetch@2.x`) y `DEP0190` (uso de `shell:true` en
  Windows, necesario porque `yarn` allí es un wrapper `.cmd`).

**Depende de:** ninguno de `src/` (JS plano, sin transpilar). **Usado por:** `bin/mrpack.js`,
`bin/mrlang.js`.

---

## 2. `src/mrpack/` — CLI de ciclo de vida del proyecto

**CODEMAP:** [`src/mrpack/CODEMAP.md`](./src/mrpack/CODEMAP.md) (mapa completo: árbol de
directorios, clases, funciones exportadas y grafo de dependencias interno).

Implementa los 7 módulos de `yarn mrpack <modulo>` documentados en el README
(`devel`, `deploy`, `config`, `framework`, `init`, `update`, `autodoc`): compilación/ejecución
de workspaces, gestión de `config.workspaces.json`, instalación/actualización/envío de
frameworks compartidos (GCS), inicialización/normalización del monorepo y generación de
documentación OpenAPI.

**Punto de entrada:** `src/mrpack/main.ts` → `src/mrpack/mrpack.ts::MRPack`.

---

## 3. `src/mrlang/` — CLI de internacionalización

**CODEMAP:** [`src/mrlang/CODEMAP.md`](./src/mrlang/CODEMAP.md) (mapa completo: dos
generaciones de generador en paralelo — `clases/` v1 JSON+MySQL y `clases-v2/` v2 solo-JSON —,
clases, funciones exportadas y grafo de dependencias interno).

Implementa los 5 módulos de `yarn mrlang <modulo>`: `init` (alta del proyecto de traducciones),
`pull`/`push` (sincronización con MySQL), `generate` (JSON → clases TypeScript, con selector
`-v/--version` entre generador v1 y v2) y `fremote` (corrección de metadatos remotos).

**Punto de entrada:** `src/mrlang/main.ts` → `src/mrlang/mrlang.ts::MRLang`.

**Relación con `mrpack`:** `mrlang` reutiliza directamente clases de `mrpack` sin reexportarlas
(`Colors` de `mrpack/clases/colors`, `Modulo`/`IModuloConfig` de `mrpack/modulo`), y
`clases/workspace/i18n.ts::I18N` (dentro de `mrpack`) lanza `mrlang generate --watch` como
proceso hijo durante `mrpack devel`. No hay dependencia inversa: `mrpack` no importa nada de
`mrlang` salvo a través de ese `spawn`.

---

## 4. `src/utiles/` — utilidades compartidas entre `mrpack` y `mrlang`

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `fs.ts` | `readDir`, `readFile`, `readFileBuffer`, `readFileString`, `readJSON`, `readJSONSync`, `isDir`, `isFile`, `mkdir`, `rmdir`, `safeWrite`, `unlink`, `md5Dir` |
| `log.ts` | `info`, `warning`, `error` |

### Símbolos

#### `fs.ts`
Fork local de `services-comun/modules/utiles/fs.ts`, reducido a solo las funciones que usa
`@mr/cli`. El original importa `error`/`warning` de un `log.ts` que depende de `dd-trace`; este
fork usa en su lugar `./log.ts` (este mismo bloque), evitando arrastrar `dd-trace` al bundle de
la CLI a través de esa ruta de imports.

```ts
readJSON<T>(file: PathLike|FileHandle): Promise<T>
readJSONSync<T>(file: PathOrFileDescriptor): T|null
safeWrite(local: PathLike, data: string|Buffer, sobreescribir?: boolean, excepcion?: boolean): Promise<boolean>
  // Escribe en <local>.<random> con flag "wx", y solo entonces renombra sobre local (rename atómico);
  // si sobreescribir=false y ya existe destino, no sobreescribe (devuelve false) — patrón write-then-rename
md5Dir(dir: string): Promise<string>   // hash MD5 recursivo del árbol (nombre+contenido de cada fichero)
```

#### `log.ts`
Fork mínimo de `services-comun/modules/utiles/log.ts`, sin dependencia de `dd-trace` ni de los
modos `KUBERNETES`/`DATADOG` (irrelevantes: `mrpack`/`mrlang` corren siempre en local/CI).

```ts
info(...txt: any[]): void      // console.info
warning(...txt: any[]): void   // console.warn
error(...txt: any[]): void     // console.error
```

**Depende de:** `services-comun/modules/utiles/{hash,random}` (solo `fs.ts`, para `md5Dir`).
**Usado por:** ambos submódulos (`mrpack/clases/*`, `mrlang/clases*/*`) para toda su E/S de
disco y logging de bajo nivel; `mrpack/clases/log.ts::Log` es una capa superior propia (con
prefijo `[hora][tipo][etiqueta]` y anidamiento) que **no** reutiliza `src/utiles/log.ts`.

---

## 5. `manifest/` — Manifest raíz del monorepo (`mrpack.json` de la raíz)

**README:** [`manifest/README.md`](./manifest/README.md) (esquema JSON completo, valores por
defecto y variables de entorno de cada campo).

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `index.ts` | `IManifest`, `Manifest` |
| `deploy/index.ts` | `IManifestDeployment`, `ManifestDeployment` |
| `deploy/build.ts` | `IManifestDeploymentBuild`, `ManifestDeploymentBuild` |
| `deploy/run.ts` | `IManifestDeploymentRun`, `ManifestDeploymentRun` |

Define el esquema TypeScript del `mrpack.json` de raíz (bloque `deploy.{build,run}`), leído por
`yarn mrpack deploy`. Es distinto del manifest **por workspace** (`src/mrpack/clases/manifest/`,
documentado en [`src/mrpack/CODEMAP.md`](./src/mrpack/CODEMAP.md)): este bloque solo modela el
manifest de la raíz del monorepo, no el de cada `service`/`job`/`cronjob` individual.

**Depende de:** nada externo (tipos/clases planas). **Usado por:**
`src/mrpack/clases/manifest/root/` (`ManifestRootLoader`, que carga/normaliza/persiste este
esquema) — la relación entre este directorio y su consumidor real en `src/mrpack/` está
documentada con más detalle en `src/mrpack/CODEMAP.md`.

---

## 6. `deployment/` — Infraestructura CI/CD (Cloud Build)

**README:** [`deployment/README.md`](./deployment/README.md) (pipeline `build.yaml` completo,
diagrama de dependencias entre pasos, comandos `bin/` disponibles en el `PATH` del pipeline,
Dockerfiles y plantillas Cloud Run).

No contiene código TypeScript: son scripts Bash (`deployment/std/*.sh`), plantillas YAML
(Cloud Build, Cloud Run) y Dockerfiles, invocados por Cloud Build a través de
`deployment/std/build.yaml`. Los scripts leen los manifests generados por `mrpack`
(`mrpack.json` raíz y por workspace) a través de los comandos `configg`/`configw`
(`deployment/std/bin/`, wrappers de `jq`).

**Depende de (en tiempo de ejecución del pipeline):** los artefactos de `yarn mrpack deploy`
(`output/`, `version.txt`, `hash.txt` de cada workspace) y el esquema de `manifest/` (bloque 5)
para decidir si compilar/desplegar. **No depende de** ni es importado por ningún fichero
TypeScript de `src/`.

---

## 7. Compilación del paquete

Los ejecutables de `@mr/cli` (`bin/min/{mrpack,mrlang}-run.js`) se generan con
**[esbuild](https://esbuild.github.io/)** a partir de `src/mrpack/main.ts` y `src/mrlang/main.ts`
respectivamente. Ver el detalle completo (targets, externals, tamaños, source maps y la
resolución de `tscBin`/fijación de `typescript@^6.x`) en
[`README.md#compilación-del-paquete`](./README.md#compilación-del-paquete); no se duplica aquí.

Scripts relevantes (`package.json`): `compile` (build de producción), `compile:watch` (watch),
`compile:rspack` (fallback al bundler anterior).

---

## Diagrama de dependencias entre bloques

```
bin/{mrpack,mrlang}.js ──→ bin/lib.js ──→ bin/min/{mrpack,mrlang}-run.js (compilado desde src/*/main.ts)
                                                    │
                                                    ▼
                                          src/mrpack/main.ts          src/mrlang/main.ts
                                                    │                          │
                                                    ▼                          ▼
                                          src/mrpack/mrpack.ts::MRPack   src/mrlang/mrlang.ts::MRLang
                                                    │                          │
                                    (7 módulos: devel/deploy/config/    (5 módulos: fremote/generate/
                                     framework/init/update/autodoc)      init/pull/push)
                                                    │                          │
                                                    │        reutiliza Colors, Modulo/IModuloConfig
                                                    │◄─────────────────────────┘
                                                    │        (mrlang no reexporta, importa directo)
                                                    │
                                    src/mrpack/clases/workspace/i18n.ts::I18N
                                          └─→ spawn("mrlang generate --watch")   (única dependencia mrpack→mrlang, vía proceso hijo)
                                                    │
                                                    ▼
                                             src/utiles/{fs,log}.ts   ◄── usado también por src/mrlang/clases*/*
                                                    │
                                                    ▼
                                  manifest/ (esquema mrpack.json raíz)
                                       ▲
                                       │ consumido por
                          src/mrpack/clases/manifest/root/::ManifestRootLoader
                                       │
                                       ▼
                          deployment/std/build.yaml (Cloud Build; lee manifest/ vía bin/configg,
                                                      ejecuta "yarn mrpack deploy"/"yarn mrpack autodoc")
```

**Regla de dependencia:** `mrlang` puede importar de `mrpack` (comparte su clase `Modulo` base y
sus utilidades de colores/log), pero `mrpack` nunca importa código TypeScript de `mrlang` — la
única integración es el `spawn` de proceso hijo desde `I18N` durante `mrpack devel`. `manifest/`
y `deployment/` no dependen de ningún código de `src/`; son consumidos por él (el primero
tipando el `mrpack.json` raíz, el segundo ejecutando los binarios compilados en CI/CD).
