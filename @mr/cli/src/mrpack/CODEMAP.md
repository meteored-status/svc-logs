# CODEMAP — `@mr/cli/src/mrpack/`

> Generado: 2026-06-26. Actualizar tras cambios significativos. Última revisión: 2026-07-17 (`mrpack devel`: nuevo flag `-w/--watch`; sin él los compiladores compilan una única vez y el proceso termina; añadido `.codex/` a la plantilla `IGNORE` de `init/ignore.ts` para que `mrpack init` lo incluya en el `.gitignore` del monorepo; nueva `initClaude()` en
`init/symlinks.ts`, que crea/corrige el symlink `CLAUDE.md` → `@mr/core/dev/CLAUDE.md`
—fichero que solo importa `@AGENTS.md`, ya que Claude Code no lee `AGENTS.md`
automáticamente—; extraído `initSymlinkFichero()` compartido por `initAgents`/`initClaude`;
nueva `initClaudeDir()` en `init/symlinks.ts`, con la misma forma que `initGithub()` (junction
en Windows, symlink relativo en Unix), que symlinkea el directorio completo `.claude` →
`@mr/core/dev/.claude` —declara el hook `Stop` de mantenimiento CODEMAP/CHANGELOG, ver
`@mr/core/dev/.claude/CODEMAP.md`—; nueva `migrarArchivosLocales()` que preserva
`.claude/settings.local.json` (excluido del envío del framework vía
`@mr/core/dev/.claude/.mr-ignore`) si `.claude` ya existía como directorio real, moviendo sus
entradas a `@mr/core/dev/.claude/` antes de sustituirlo por el symlink; añadido
`**/.claude/settings.local.json` a la plantilla `IGNORE` de `init/ignore.ts` para que
`mrpack init` lo excluya también del `.gitignore` del monorepo).
Última revisión: 2026-07-17 (rediseño de `config.workspaces.json`: las antiguas propiedades
planas `devel`/`packd` —`{available:string[], disabled:string[]}`— y `services` —mapa de
variables de entorno nunca consumido— se sustituyen por `workspaces`, que agrupa los
workspaces por `deploy.type` (`browser`/`cronjobs`/`jobs`/`services`, vía nueva
`grupoDeploy()` en `workspace/service.ts`) con un flag booleano `ejecutar`/`compilar` por
workspace (nueva `IWorkspaceFlags`/`IConfigWorkspaces`/`flagsWorkspace()`); `initConfig()`
(`init/config-workspaces.ts`) migra automáticamente tanto el formato antiguo (listas planas)
como el intermedio (`packd`/`devel` dentro de `workspaces`, usado brevemente antes de
renombrarlos) la primera vez que se regenera el fichero; `Service`/`gestionarLista`
(`config/workspaces.ts`) y `listarWorkspacesConInfo`/`leerCapacidades` (`config/datos.ts`)
actualizados para leer/escribir el nuevo esquema anidado). Migrada también la propiedad
`i18n: boolean` (a nivel raíz) a `workspaces.i18n` (nueva `IConfigWorkspacesI18n`, primera
propiedad de `workspaces`, solo presente si existe el workspace `i18n`), con dos flags:
`enabled` (equivalente al `i18n` antiguo; gatea si `devel.ts::ejecutarServices()` inicia el
paso de generación de i18n) y `watch` (nuevo; controla si el workspace `I18N` arranca en modo
observación, ahora desacoplado del flag `-w` global de `mrpack devel` — antes
`I18N.watch` heredaba siempre `ejecucion.watch`). Corregido además un bloqueo real de
`mrpack devel -c -w`: `I18N.initCompilar()` (`workspace/i18n.ts`) no resolvía su `Deferred`
si `mrlang generate` terminaba en modo no-watch sin escribir nada por stdout/stderr —
añadido un handler `.on("close", ...)` que lo resuelve igualmente (mismo patrón que
`Service.initCompilar()`).
Última revisión: 2026-07-17 (`mrpack config` → "Gestionar workspaces": rediseñado de un
submenú de 3 pantallas —Compilar/Ejecutar/Generar i18n, cada una con su propia lista— a una
única pantalla con `alternarMatriz()`, nueva primitiva de `config/menu.ts` que sustituye a
`alternarLista`/`IToggleItem` (eliminados, sin otros usos): cada fila puede tener un número
distinto de casillas —`i18n` con `enabled`/`watch`; el resto de workspaces, en orden
alfabético, con `compilar`/`ejecutar` según les aplique—, navegables con ←→ dentro de la fila
activa además de ↑↓ entre filas; `gestionarLista()`/`gestionarI18n()` (`config/workspaces.ts`)
eliminadas y fusionadas en la nueva `gestionarWorkspaces()`, que construye las filas y persiste
el resultado en una sola llamada a `guardarConfig()`).
Última revisión: 2026-07-17 (`patch` se traslada de nivel raíz a `framework.patch`, como
primera propiedad de `framework` —antes de `framework.updates`—: `IConfigServices.patch`
desaparece; `initConfig()` (`init/config-workspaces.ts`) migra automáticamente el `patch` raíz
legacy; `gestionarPatches()` (`config/frameworks.ts`) lee/borra `config.framework?.patch`. El
runner de patches, `@mr/core/dev/patches/index.mjs` —paquete framework aparte—, se actualiza en
paralelo: nueva `getPatchFromConfig(json)` acepta ambas ubicaciones y `writePatchCursor()`
reconstruye `framework` para que `patch` quede primero, ver el changelog de `@mr/core-dev`).
Última revisión: 2026-07-20 (corregida la alineación de casillas en `alternarMatriz()`
—`config/menu.ts`—: la fila `i18n` y las de workspace tienen casillas con etiquetas de
distinta longitud, por lo que la segunda casilla de cada fila arrancaba en una columna
distinta; se calcula un ancho fijo por columna, `anchoColumnas[j]`, y se aplica `padEnd()` a
cada etiqueta antes de colorearla).

---

## Árbol de directorios

```
mrpack/
├── main.ts                          Entrypoint: instala source-maps y llama MRPack.run()
├── mrpack.ts                        Clase MRPack — punto de entrada CLI
├── modulo.ts                        Clase abstracta Modulo — base de todos los módulos CLI
│
├── modulos/
│   ├── auto-doc.ts                  ModuloAutoDoc   — `mrpack autodoc`
│   ├── config.ts                    ModuloConfig    — `mrpack config`
│   ├── deploy.ts                    ModuloDeploy    — `mrpack deploy`
│   ├── devel.ts                     ModuloDevel     — `mrpack devel`
│   ├── framework.ts                 ModuloFramework — `mrpack framework`
│   ├── init.ts                      ModuloInit      — `mrpack init`
│   └── update.ts                    ModuloUpdate    — `mrpack update`
│
├── clases/
│   ├── auto-doc.ts                  run() — genera docs OpenAPI via TypeScript AST + MySQL
│   ├── colors.ts                    Colors (extiende ColorsBase) — paleta cíclica 21 colores
│   ├── comando.ts                   Comando() — ejecuta proceso y captura stdout/stderr
│   ├── deploy.ts                    run() — compila todos los workspaces para producción
│   ├── devel.ts                     run() — arranca modo desarrollo (compilar+ejecutar)
│   ├── init.ts                      init() — inicializa/normaliza todo el monorepo
│   ├── log.ts                       Log — helpers info/error con timestamp
│   ├── packagejson.ts               IPackageJson, IPackageJsonLegacy — tipos de package.json
│   ├── patches.ts                   aplicarPatches() — lanza `yarn run patch:apply`
│   ├── update.ts                    init() — init + framework update + patch:apply + yarn update
│   ├── workspace.ts                 Workspace — clase base con watcher chokidar
│   ├── yarn.ts                      install(), update() — operaciones Yarn (install/dedupe/upgrade)
│   │
│   ├── config/
│   │   ├── index.ts                 gestionar() — menú principal de `mrpack config`
│   │   ├── menu.ts                  seleccionar/elegirUno/alternarMatriz — primitivas TUI readline
│   │   │                            (Render y helpers TTY importados de utiles/tty.ts)
│   │   ├── datos.ts                 cargarConfig/guardarConfig/listarWorkspacesConInfo/existeI18n
│   │   ├── workspaces.ts            gestionarWorkspaces() — pantalla única (matriz i18n + workspaces)
│   │   └── frameworks.ts            gestionarFrameworks() — submenú autoupdates/patches
│   │
│   ├── framework/
│   │   ├── index.ts                 Re-exporta todo desde cliente.ts y gestor/index.ts
│   │   ├── cliente.ts               add/remove/checkCliente/recompilarCliente/getAutor/pullPackage/…
│   │   └── gestor/
│   │       ├── index.ts             gestionar/actualizarTodo/enviarTodo/resetearTodo
│   │       ├── acciones.ts          ejecutarAcciones() — aplica la lista de Accion[]
│   │       ├── datos.ts             construirInfoPaquetes/listarNombresGCS — enum Accion, IPaqueteGestion
│   │       ├── logs.ts              escribirLog/escribirLogPush/actualizarIndiceLogs
│   │       └── tabla.ts             GestorTabla — TUI interactiva (tabla/lista/diff)
│   │                                (Render de utiles/tty.ts; LCS de utiles/diff.ts)
│   │
│   ├── init/                        Plantillas de fichero generadas por init()
│   │   ├── app.ts                   APP(config) → string — plantilla app.js
│   │   ├── attributes.ts            ATTRIBUTES — .gitattributes
│   │   ├── datadog.ts               DATADOG — static-analysis.datadog.yml
│   │   ├── devel.ts                 DEVEL — devel.js
│   │   ├── editorconfig.ts          EDITORCONFIG — .editorconfig
│   │   └── ignore.ts                IGNORE — .gitignore
│   │
│   ├── manifest/
│   │   ├── index.ts                 ManifestLoader<T,K> — cargador base abstracto de mrpack.json
│   │   ├── root/
│   │   │   ├── index.ts             ManifestRootLoader — carga mrpack.json raíz del monorepo
│   │   │   └── deploy/
│   │   │       ├── index.ts         ManifestRootDeploy — sección deploy del manifest raíz
│   │   │       ├── build.ts         ManifestRootDeployBuild — config build del deploy raíz
│   │   │       └── run.ts           ManifestRootDeployRun — config run del deploy raíz
│   │   └── workspace/
│   │       ├── index.ts             ManifestWorkspaceLoader — carga mrpack.json de workspace
│   │       ├── legacy.ts            IManifestLegacy — estructura legacy de mrpack en package.json
│   │       ├── development.ts       ManifestWorkspaceDevelopment — sección development
│   │       ├── build/
│   │       │   ├── index.ts         ManifestWorkspaceBuild — sección build
│   │       │   ├── database.ts      ManifestWorkspaceBuildDatabase — config DB
│   │       │   └── bundle/
│   │       │       ├── index.ts     ManifestWorkspaceBuildBundle — config bundle
│   │       │       ├── base.ts      ManifestWorkspaceBuildBundleBase
│   │       │       └── componentes.ts ManifestWorkspaceBuildBundleComponentes
│   │       └── deployment/
│   │           ├── index.ts         ManifestWorkspaceDeployment — sección deployment
│   │           ├── credenciales.ts  ManifestWorkspaceDeploymentCredenciales
│   │           ├── kustomize.ts     ManifestWorkspaceDeploymentKustomize
│   │           ├── imagen/
│   │           │   ├── index.ts     ManifestWorkspaceDeploymentImagen
│   │           │   └── entorno.ts   ManifestWorkspaceDeploymentImagenEntorno
│   │           ├── lambda/
│   │           │   └── index.ts     ManifestWorkspaceDeploymentLambda
│   │           └── storage/
│   │               ├── index.ts     ManifestWorkspaceDeploymentStorage
│   │               └── buckets.ts   ManifestWorkspaceDeploymentStorageBuckets
│   │
│   ├── paquete/
│   │   ├── index.ts                 Paquete — ciclo de vida GCS (pull/push/reset/checkUpdate/…)
│   │   │                            + subirLogHtml() — sube el log HTML del último push
│   │   ├── directory.ts             PaqueteDirectory — árbol de directorios recursivo
│   │   ├── file.ts                  PaqueteFile — nodo hoja con hash MD5; stripAutoria()
│   │   ├── push-log.ts              IPushLogData/IArchivoConDiff — tipos y generador HTML del
│   │   │                            log de push; subirLogHtmlPush() — sube a GCS
│   │   │                            (LCS de utiles/diff.ts)
│   │   ├── root.ts                  PaqueteDirectoryRoot — directorio raíz con versión
│   │   └── storage.ts               PaqueteStorage — acceso GCS (stable.txt, ZIP upload/download)
│   │
│   └── workspace/
│       ├── compilar.ts              Compilar — compila/empaqueta un workspace (rspack/nextjs/…)
│       ├── i18n.ts                  I18N extends Workspace — lanza mrlang generate --watch
│       └── service.ts               Service extends Workspace — ejecuta/compila un servicio
│
└── utiles/
    ├── colors.ts                    Colors — constantes ANSI + colorize/up/down
    ├── diff.ts                      calcularDiffOps/indicesConContexto — algoritmo LCS compartido
    ├── merge.ts                     merge3() — diff3 3-way merge con marcadores de conflicto
    ├── output-capture.ts            interceptarSalida() — redirige stdout/stderr durante TUI
    ├── tty.ts                       Render/prepararTTY/restaurarTTY — primitivas TTY compartidas
    └── version.ts                   parsearFechaVersion/compararVersiones/maquetarVersion/incrementarVersion
```

---

## Módulos raíz

### `main.ts`
```
Entrypoint. Instala source-map-support y delega en MRPack.run().
```

### `modulo.ts`
```ts
export interface IModuloConfig extends ParseArgsConfig {
    options: { help: {type:"boolean",short:"h",default:false}; version?:... };
}
export interface IModulo { help: boolean; }

export abstract class Modulo<T extends IModuloConfig> {
    protected static OPTIONS: IModuloConfig
    public static run<T>(modulo: Modulo<T>): void   // arranca con PromiseDelayed
    public readonly root: string
    protected async run(): Promise<void>            // parsea args → parsePositionals + parseParams
    protected async parsePositionals(positionals: string[]): Promise<void>   // hook override
    protected abstract parseParams(config: IModulo, positionals?: string[]): Promise<void>
    protected abstract mostrarAyuda(): void
}
```

### `mrpack.ts`
```ts
export class MRPack<T extends IMRPackConfig> extends Modulo<T> {
    // Submódulos: "autodoc"|"config"|"devel"|"deploy"|"framework"|"init"|"update"
    public static override run(): void
    protected override async run(): Promise<void>       // muestra versión del CLI
    protected override async parsePositionals(positionals: string[]): Promise<void>
    protected async parseParams(config: IMRPack, positionals: string[]): Promise<void>  // delega en ModuloXxx.run()
}
```

---

## Módulos CLI (`modulos/`)

| Fichero | Clase | Flags CLI | Delega en |
|---------|-------|-----------|-----------|
| `auto-doc.ts` | `ModuloAutoDoc` | `--env <string>` | `clases/auto-doc.ts → run()` |
| `config.ts` | `ModuloConfig` | _(ninguno extra)_ | `clases/config → gestionar()` |
| `deploy.ts` | `ModuloDeploy` | `--env produccion\|test` | `clases/deploy.ts → run()` |
| `devel.ts` | `ModuloDevel` | `-c/--compilar`, `-e/--ejecutar`, `-f/--forzar`, `-w/--watch` | `clases/devel.ts → run()` |
| `framework.ts` | `ModuloFramework` | `-u/--update`, `-r/--reset`, `-s/--send`, `-y/--yes` | `clases/framework → actualizarTodo/resetearTodo/enviarTodo/gestionar` |
| `init.ts` | `ModuloInit` | _(ninguno extra)_ | `clases/init.ts → init()` |
| `update.ts` | `ModuloUpdate` | _(ninguno extra)_ | `clases/update.ts → init()` |

---

## Clases principales

### `clases/workspace.ts` — `Workspace`
```ts
export interface IWorkspace { nombre: string; path?: string; root: string; watch: boolean; }

export class Workspace {
    public addHijo(ws: Workspace): void
    public async init(): Promise<void>      // run() + initWatcher() si watch; idempotente
    public parar(): void                   // cierra el FSWatcher
    public cambio(): void                  // notifica a hijos
    protected async run(): Promise<void>   // override para compilar
    protected initWatcher(): void
}
```

### `clases/workspace/service.ts` — `Service extends Workspace`
```ts
export const enum FrameworkUpdates { all="all", daily="daily", weekly="weekly" }
export function sanitizeFrameworkUpdates(value: unknown): FrameworkUpdates
export type GrupoWorkspace = "browser" | "cronjobs" | "jobs" | "services";
export function grupoDeploy(tipo: ManifestDeploymentKind): GrupoWorkspace|undefined  // deploy.type → grupo; undefined si no gestionable (p.ej. "worker")
export interface IWorkspaceFlags { ejecutar?:boolean; compilar?:boolean; }
export interface IConfigWorkspacesI18n { enabled?:boolean; watch?:boolean; }  // enabled: inicia el paso i18n al compilar; watch: i18n observa cambios (independiente del -w global)
export interface IConfigWorkspaces {
    i18n?: IConfigWorkspacesI18n;  // solo presente si existe el workspace i18n
    browser?: Record<string,IWorkspaceFlags>;
    cronjobs?: Record<string,IWorkspaceFlags>;
    jobs?: Record<string,IWorkspaceFlags>;
    services?: Record<string,IWorkspaceFlags>;
}
export function flagsWorkspace(workspaces: IConfigWorkspaces|undefined, nombre:string): IWorkspaceFlags  // busca por nombre en los 4 grupos deploy.type (no incluye i18n)
export interface IConfigServices {
    workspaces?: IConfigWorkspaces;
    framework?: {patch?:string; updates: FrameworkUpdates};  // patch: último RXXX aplicado por patch:apply, primera propiedad
}
// Service: lanza/reinicia el proceso del servicio con spawn; respeta config.workspaces.json
// (flags ejecutar/compilar resueltos vía flagsWorkspace(), sin importar en qué grupo esté)
export class Service extends Workspace {
    public updateGlobal(config: IConfigServices): void
}
```

### `clases/workspace/compilar.ts` — `Compilar`
```ts
export class Compilar {
    public static async build(basedir:string, name:string, path:string): Promise<Compilar|null>
    public checkDependencias(compilaciones: Compilar[]): void
    public get dependiente(): boolean
    public async pack(env:string, manifest: ManifestRoot): Promise<void>
    public static async md5Deps(basedir:string): Promise<void>
}
```

### `clases/workspace/i18n.ts` — `I18N extends Workspace`
```ts
export class I18N extends Workspace {
    // this.compilar = global.workspaces?.i18n?.enabled ?? true (gatea si se lanza mrlang generate)
    // this.watch (heredado de Workspace) ahora lo fija devel.ts con workspaces?.i18n?.watch ?? false,
    // ya no con el flag -w/--watch global de `mrpack devel`
    // Lanza `mrlang generate` (con `--watch` solo si `this.watch`); se reinicia ante cambios .json
    // initCompilar() espera (deferred) a la 1ª línea de stdout/stderr del proceso para
    // considerarlo arrancado; el handler `close` (fix: antes ausente) también resuelve ese
    // deferred, necesario porque `Generate.run()` (mrlang/clases/generate.ts) no escribe NADA
    // por consola cuando corre sin --watch — sin el handler, `initCompilar()` (y quien espera
    // `i18n.init()`, es decir `devel.ts`) se quedaba bloqueado para siempre
    public updateGlobal(config: IConfigServices): void
}
```

### `clases/paquete/index.ts` — `Paquete`
```ts
export const enum PaqueteTipo { root="root", core="core", user="user", legacy="legacy" }
export const enum EstadoArchivo { Cambiado="cambiado", Nuevo="nuevo", Eliminado="eliminado" }
export const enum OrigenArchivo { Local="local", Remoto="remoto", Ambos="ambos" }
export interface IArchivoCambiado { archivo:string; estado:EstadoArchivo; origen:OrigenArchivo; conflicto?:boolean; }
export interface IPackageFW extends IPackageJson { config: {bucket:string;subible:boolean;tipo:PaqueteTipo}; }

export class Paquete {
    // STATIC
    public static async build(basedir:string): Promise<Paquete>
    public static async loadAll(basedir:string, indexCli?:boolean): Promise<[Paquete,...Paquete[]]>
    public static buildVirtual(npmName:string, tipo:PaqueteTipo, bucket?:string): Paquete
    public static formatVersion(version:string): string
    public static setupConsolaParaUpdate(paquetes:Paquete[]): void
    // INSTANCE
    public readonly nombre: string
    public readonly logs: string[]
    public error: string|undefined                                  // mensaje/stack si applyUpdate lanzó una excepción
    public get versionPublica(): string
    public get esSubible(): boolean
    public invalidarCacheVersion(): void
    public async getVersionRemota(): Promise<string|undefined>
    public getVersionesRemota(): Promise<string[]>
    public async pull(actualizar:boolean): Promise<boolean>          // descarga y aplica última versión
    public async push(autor:string): Promise<boolean>                // empaqueta y sube a GCS
    public async reset(): Promise<void>                              // descarta cambios locales
    public async checkUpdate(): Promise<string|undefined>
    public async checkCambiosLocales(): Promise<boolean>
    public async applyUpdate(latest:string): Promise<{cambio:boolean;conflictos:boolean;entradas:{archivo:string;estado:"ok"|"error"}[]}>
    public async getArchivosCambiados(): Promise<IArchivoCambiado[]|null>
    public async getArchivosModificadosPorUpdate(latest:string): Promise<IArchivoCambiado[]|null>
    public async getArchivosCambiadosCombinados(latest:string): Promise<IArchivoCambiado[]|null>
    public async getDiffFichero(relativePath:string): Promise<{original:string;nuevo:string;offsetOriginal:number;offsetNuevo:number;autor:string}|null>
    public async getDiffFicheroDesdeRemoto(relativePath:string, latest:string): Promise<{…}|null>
    public etiquetaUpdate(latest:string, {padding}?:{padding?:number}): string
    public async subirLogHtml(): Promise<void>   // sube el log HTML del último push a GCS
}
```

### `clases/paquete/push-log.ts`
```ts
export type TEstadoArchivoPush = "cambiado" | "nuevo" | "eliminado"
export interface IArchivoConDiff {
    archivo:string; estado:TEstadoArchivoPush;
    contenidoOriginal:string; contenidoNuevo:string;
}
export interface IPushLogData {
    autor:string; version:string; versionAnterior:string;
    npmName:string; proyecto:string; fecha:Date; archivos:IArchivoConDiff[];
}
export function generarHtmlPush(data:IPushLogData): string   // HTML auto-contenido
export async function subirLogHtmlPush(bucket:string, data:IPushLogData): Promise<void>
// Ruta GCS: logs/{framework}/{version}.html
// Helpers internos: pad2, formatearFechaLocal (hora local + TZ), CSS_HTML_PUSH (constante)
// bin/min/* excluidos de diffs; header sticky con modo compacto (IntersectionObserver)
```

### `clases/paquete/storage.ts` — `PaqueteStorage`
```ts
export class PaqueteStorage {
    public invalidarCache(): void
    public async getLatest(): Promise<string|undefined>      // lee stable.txt de GCS
    public async getListaCache(): Promise<string[]>          // historial de stable.txt
    public async getZIP(nombre:string): Promise<PaqueteDirectoryRootFiles>
    public async subirPaquete(version:string, status:PaqueteDirectoryRoot): Promise<void>
    public async subirLatest(version:string): Promise<void>
}
```

### `clases/paquete/root.ts` — `PaqueteDirectoryRoot`
```ts
export interface IPaqueteDirectoryRoot extends IPaqueteDirectory { version: string; }
export interface PaqueteDirectoryRootFiles {
    status?: PaqueteDirectoryRoot;
    files: {[key:string]: JSZip.JSZipObject};
}
export class PaqueteDirectoryRoot extends PaqueteDirectory {
    public version: string
    public static build(nombre:string, basedir:string): PaqueteDirectoryRoot
    public clone(): PaqueteDirectoryRoot
    public async actualizarVersion(nuevo:PaqueteDirectoryRootFiles, antiguo:PaqueteDirectoryRootFiles): Promise<{actualizado:boolean;conflicto:boolean;entradas:{archivo:string;estado:"ok"|"error"}[]}>
    public async resetearVersion(nuevo:PaqueteDirectoryRootFiles): Promise<void>
    public async crearVersion(autor:string): Promise<boolean>
    public async update(basedir:string, autor:string): Promise<boolean>
    public actualizarAutor(versionBase:string, autor:string): void
    public async prepararParaPush(autor:string): Promise<void>
    public getArchivosCambiados(): string[]
    public listarRutas(): string[]
    public getAutorArchivo(ruta:string): string
}
```

### `clases/paquete/directory.ts` — `PaqueteDirectory extends PaqueteFile`
```ts
export interface IPaqueteDirectory extends IPaqueteFile { hijos: Record<string,IPaqueteFile|IPaqueteDirectory>; }
export class PaqueteDirectory extends PaqueteFile {
    // Operaciones recursivas de hash, actualización y reset sobre árbol de directorios
}
```

### `clases/paquete/file.ts` — `PaqueteFile`
```ts
export function stripAutoria(contenido:string): string    // elimina bloque de autoría de .ts
export class PaqueteFile {
    // nodo hoja con hash MD5 y métodos de actualización/reset individual
}
```

---

## Framework (GCS) — `clases/framework/`

### `cliente.ts` (re-exportado desde `index.ts`)
```ts
export async function add(basedir:string, frameworks:string[], visitados?:Set<string>): Promise<boolean>
export async function remove(basedir:string, frameworks:string[]): Promise<boolean>
export async function checkCliente(basedir:string): Promise<string|undefined>   // hash local vs MD5
export async function recompilarCliente(basedir:string, hash:string, config?:{reiniciar?:boolean;skipInstall?:boolean}): Promise<void>
export async function getAutor(): Promise<string>              // git config user.name
export async function getClienteHash(basedir:string): Promise<string>
export async function getClienteMD5(basedir:string): Promise<string>
export async function pullPackage(dir:string, forzar:boolean): Promise<boolean>
export async function leerDepsMrFramework(localDir:string): Promise<string[]>
export async function encontrarWorkspacesConDep(basedir:string, npmName:string): Promise<string[]>
export async function limpiarDevDepsConsumidores(basedir:string, npmNames:string[]): Promise<void>
```

### `gestor/datos.ts`
```ts
export const enum Accion {
    Nada="nada", Instalar="instalar", Actualizar="actualizar",
    Resetear="resetear", Desinstalar="desinstalar",
    Enviar="enviar", EnviarConUpdate="enviarConUpdate"
}
export interface IPaqueteGestion {
    tipo:""|"core"|"user"|"legacy"; nombre:string; npmName:string; localDir:string;
    paquete:Paquete; instalado:boolean; tieneUpdate:boolean;
    versionLocal:string|undefined; versionLatest:string|undefined;
    esCli:boolean; esLegacy:boolean; tieneCambiosLocales:boolean; versionesRemota:string[];
}
export async function listarNombresGCS(subdir:string, config?:{bucket?:string}): Promise<string[]>
export async function construirInfoPaquetes(basedir:string, config?:{checkCambios?:boolean;bucket?:string;soloInstalados?:boolean}): Promise<IPaqueteGestion[]>
```

### `gestor/index.ts`
```ts
export async function gestionar(basedir:string, config?:{reiniciar?:boolean}): Promise<boolean>
export async function actualizarTodo(basedir:string, config?:{forzar?:boolean;reiniciar?:boolean;frameworkUpdates?:FrameworkUpdates}): Promise<boolean>
export async function enviarTodo(basedir:string, config?:{forzar?:boolean;reiniciar?:boolean}): Promise<boolean>
export async function resetearTodo(basedir:string, config?:{forzar?:boolean;reiniciar?:boolean}): Promise<boolean>
```

### `gestor/acciones.ts`
```ts
export async function ejecutarAcciones(basedir:string, infos:IPaqueteGestion[], accionesArr:Accion[], config?:{reiniciar?:boolean}): Promise<boolean>
// Flujo: instalar → actualizar → resetear → desinstalar → add deps transitivas → install → patches → recompilarCliente → enviar (+ subirLogHtml) → enviarConUpdate (+ subirLogHtml) → gestionar conflictos
```

### `gestor/tabla.ts` — `GestorTabla`
```ts
export type GestorModo = "todos"|"update"|"reset"|"send"

export class GestorTabla {
    public constructor(infos:IPaqueteGestion[], config?:{modo?:GestorModo;frameworkUpdates?:FrameworkUpdates;defaultAcciones?:Accion[]})
    public static tieneEnviar(info:IPaqueteGestion): boolean
    public static tieneEnviarConUpdate(info:IPaqueteGestion): boolean
    public async run(config?:{autoConfirmMs?:number}): Promise<Accion[]|null>
    // Vistas: "tabla" (navegar ↑↓, cambiar acción ←→) | "lista" (ficheros cambiados) | "diff" (side-by-side)
    // Teclas: ↑↓ navegar, ←→ cambiar acción, n nada, a actualizar todos, r resetear todos, e enviar todos, d ver cambios, Intro confirmar, Esc cancelar
    // Render: Render de utiles/tty.ts; LCS: calcularDiffOps de utiles/diff.ts
}
```

### `gestor/logs.ts`
```ts
export async function escribirLog(basedir:string, info:IPaqueteGestion, entradas:{archivo:string;estado:"ok"|"error"}[], logsRaw:string[], error?:string): Promise<string>
export async function escribirLogPush(basedir:string, info:IPaqueteGestion, archivos:string[]): Promise<string>
export async function actualizarIndiceLogs(logDir:string): Promise<void>
// Escribe en tmp/log/{nombre}.pull.md y tmp/log/{nombre}.push.md
```

---

## Config (`config.workspaces.json`) — `clases/config/`

### `index.ts`
```ts
export async function gestionar(basedir:string): Promise<void>
// Menú principal de `mrpack config`. Opciones: "Framework" → gestionarFrameworks()
//                                              · "Workspaces" → gestionarWorkspaces()
```

### `workspaces.ts`
```ts
export async function gestionarWorkspaces(basedir:string): Promise<void>
// Pantalla única (sin submenús), vía alternarMatriz() de menu.ts: fila "i18n" primero
// (casillas enabled/watch, solo si existe el workspace i18n) y a continuación el resto de
// workspaces en orden alfabético, cada uno con las casillas compilar/ejecutar que le
// apliquen según compilable/ejecutable. Persiste workspaces.i18n.{enabled,watch} y
// workspaces.<grupo>.<nombre>.{compilar,ejecutar} en un solo guardarConfig().
```

### `frameworks.ts`
```ts
export async function gestionarFrameworks(basedir:string): Promise<void>
// Submenú: Autoupdates (elegirUno de framework.updates: all/daily/weekly)
//          · Patches (elimina framework.patch para forzar reaplicación)
```

### `datos.ts`
```ts
export const GRUPOS = ["cronjobs","jobs","scripts","services"] as const;  // directorios físicos donde se descubren workspaces
export interface IInfoWorkspace { nombre:string; compilable:boolean; ejecutable:boolean; grupo:GrupoWorkspace }
export async function cargarConfig(basedir:string): Promise<IConfigServices>           // lee con defaults ({workspaces:{}, i18n:true})
export async function guardarConfig(basedir:string, config:IConfigServices): Promise<void>  // safeWrite directo (sin normalización de listas)
export async function listarWorkspacesConInfo(basedir:string): Promise<IInfoWorkspace[]>    // lee mrpack.json de cada workspace; excluye los sin grupo gestionable
// compilable = runtime !== "php" | ejecutable = framework === "meteored" && runtime === "node"
// grupo = grupoDeploy(deploy.type) — grupo de config.workspaces.json, independiente del directorio físico (GRUPOS)
export async function existeI18n(basedir:string): Promise<boolean>
```

### `menu.ts` — primitivas TUI readline
```ts
export interface IMenuOpcion<T> { label:string; value:T; descripcion?:string; disabled?:boolean }
export interface ICheckbox { key:string; label:string; checked:boolean }
export interface IFilaMatriz { label:string; checkboxes:ICheckbox[] }
export async function seleccionar<T>(titulo:string, opciones:IMenuOpcion<T>[], config?:{inicial?:number}): Promise<T|null>
export async function elegirUno<T>(titulo:string, opciones:IMenuOpcion<T>[], config?:{inicial?:number}): Promise<T|null>
export async function alternarMatriz(titulo:string, filas:IFilaMatriz[]): Promise<Record<string,boolean>[]|null>
// Render, prepararTTY, restaurarTTY importados de utiles/tty.ts
// Modo raw + redibujado con Colors.up; ↑↓ navegar fila, ←→ navegar casilla de la fila activa
// (número de casillas variable por fila), Espacio alternar, a/n marcar/desmarcar todas,
// Intro confirmar, Esc cancelar
// anchoColumnas[j] = máximo cb.label.length en la columna j entre todas las filas —
// las etiquetas se rellenan con padEnd() a ese ancho para que las casillas de filas con
// distinto contenido (p.ej. i18n "enabled"/"watch" vs workspace "compilar"/"ejecutar")
// queden alineadas verticalmente
```

---

## Clases de init

### `clases/init.ts`
```ts
export interface IPackageJson extends IPackageJsonBase { config?: IManifestLegacy; }
export async function init(basedir:string): Promise<boolean>
// Flujo: checkCliente → initBase → deleteFiles → limpiarLegacy → corregirGITs
//        → initWorkspaces → initConfig → initYarnRC → mrlang init (si existe i18n)
// Retorna true si hubo cambios que requieren reinstalar
```

### `clases/update.ts`
```ts
export async function init(basedir:string): Promise<void>
// Flujo: initWS → actualizarTodo(forzar=true) → [si cambio: aplicarPatches + initWS] → update(yarn)
```

### `clases/patches.ts`
```ts
export function aplicarPatches(basedir:string): Promise<void>
// Spawn `yarn run patch:apply` con stdio:"inherit"
```

---

## Clases de deploy

### `clases/deploy.ts`
```ts
export function run(basedir:string, env:string): void
// Carga ManifestRoot → Compilar.build para cronjobs/services/jobs → i18n generate (si habilitado)
// → Compilar.md5Deps + compilar en paralelo filtrando dependientes
```

### `clases/devel.ts`
```ts
export interface IConfigEjecucion { compilar:boolean; ejecutar:boolean; forzar:boolean; watch:boolean; }
export function run(basedir:string, config:IConfigEjecucion): void
// Si compilar: init + actualizarTodo + install
// Siempre: ejecutarWorkspaces(@mr/core,@mr/user,framework,packages) → ejecutarServices(cronjobs,jobs,scripts,services)
// watch=false (por defecto): no se registra ningún FSWatcher; el proceso termina al acabar los compiladores
// watch=true: Watcher sobre config.workspaces.json para recargar en caliente + watchers de cada Workspace/Service
// I18N es la excepción: su propio watch NO usa `config.watch` (el -w/--watch global), sino
// `config_global.workspaces?.i18n?.watch ?? false`, fijado una sola vez al construir la instancia
```

---

## Clases de auto-doc

### `clases/auto-doc.ts`
```ts
export interface IConfigEjecucion { env:string; }
export function run(basedir:string, config:IConfigEjecucion): void
// Parsea main.ts de cada service con TypeScript API
// Busca clases que extienden RouteGroup → extrae endpoints y esquemas
// Genera spec OpenAPI 3.1 y guarda en MySQL (base de datos "doc")
```

---

## Manifest (`clases/manifest/`)

### `index.ts` — `ManifestLoader<T,K>`
```ts
export abstract class ManifestLoader<T, K extends ManifestRoot<T>> {
    public static getFile(basedir:string): string
    public manifest: K
    public abstract check(manifest?:Partial<T>, paquete?:IPackageJsonLegacy): T
    public async load(env?:boolean, paquete?:IPackageJsonLegacy): Promise<ManifestLoader<T,K>>
    public async save(): Promise<void>
    public fromLegacy(legacy:IManifestLegacy, paquete?:IPackageJsonLegacy): ManifestLoader<T,K>
}
```

### Loaders concretos
| Clase | Fichero | `mrpack.json` que carga |
|-------|---------|------------------------|
| `ManifestRootLoader` | `root/index.ts` | Raíz del monorepo |
| `ManifestWorkspaceLoader` | `workspace/index.ts` | Workspace individual (service/job/…) |

---

## Yarn (`clases/yarn.ts`)
```ts
export async function install(basedir:string, config?:{verbose?:boolean;install?:boolean;optimize?:boolean}): Promise<void>
// yarn install + yarn dedupe --strategy highest
export async function update(basedir:string, doInstall:boolean): Promise<void>
// yarn set version latest + (opcional) install + yarn upgrade-interactive + install
```

---

## Utilidades (`utiles/`)

### `colors.ts` — `Colors`
```ts
export class Colors {
    public static Reset/Bright/Dim/Underscore/… : string   // constantes ANSI
    public static colorize(config:string[], text:string, {tty?}?:{tty?:boolean}): string
    public static up(posiciones:number): string    // ESC[NA
    public static down(posiciones:number): string  // ESC[NB
}
```

### `diff.ts` — algoritmo LCS compartido
```ts
export interface IDiffRawOp { tipo:"equal"|"add"|"remove"; linea:string; }
export const DIFF_CONTEXTO: number        // líneas de contexto por defecto (3)
export function calcularDiffOps(aLines:string[], bLines:string[], maxLineas:number): IDiffRawOp[]|null
export function indicesConContexto(ops:IDiffRawOp[], contexto?:number): Set<number>
// Usado por: GestorTabla (tabla.ts) y generarHtmlPush (push-log.ts)
```

### `tty.ts` — primitivas TTY compartidas
```ts
export class Render {
    public dibujar(lineas:string[]): void   // redibuja bloque, borrando el anterior
    public limpiar(): void                 // borra todas las líneas dibujadas
}
export function prepararTTY(): void        // raw mode + keypress + ocultar cursor
export function restaurarTTY(): void       // restaurar modo normal + mostrar cursor
// Usado por: menu.ts (config) y GestorTabla (tabla.ts)
```

### `version.ts`
```ts
export function parsearFechaVersion(version:string): Date
export function compararVersiones(a:string, b:string): number  // -1/0/1
export function maquetarVersion(version:string): string        // "YYYY.MM.DD+N" → 13 chars
export function incrementarVersion(version:string, autor:string): string
```

### `merge.ts`
```ts
export default function merge3(base:string, version1:string, version2:string, filename:string): {text:string; conflict:boolean}
// diff3 3-way merge; conflictos marcados con <<<<<<< LOCAL / >>>>>>> REMOTE
```

### `output-capture.ts`
```ts
export function interceptarSalida(esCli:()=>boolean, logs:string[]): ()=>void
// Intercepta stdout/stderr: si esCli() pasa directo, si no acumula en logs[]
```

---

## Grafo de dependencias (simplificado)

```
MRPack
  └─→ ModuloDevel   → clases/devel    → init, actualizarTodo, Workspace, Service, I18N, yarn.install
  └─→ ModuleDeploy  → clases/deploy   → Compilar, ManifestRootLoader, Comando
  └─→ ModuloConfig  → clases/config   → gestionar → gestionarWorkspaces (menu TUI + datos config.workspaces.json)
  └─→ ModuloFramework → clases/framework → gestionar/actualizarTodo/enviarTodo/resetearTodo
                          └─→ gestor/datos      → Paquete, GCS (Storage)
                          └─→ gestor/acciones   → Paquete.applyUpdate/push/reset/subirLogHtml, aplicarPatches, recompilarCliente
                          └─→ gestor/tabla      → GestorTabla (TUI readline + Render de utiles/tty + LCS de utiles/diff)
                          └─→ gestor/logs       → tmp/log/*.md
  └─→ ModuloInit    → clases/init     → checkCliente, initBase, initWorkspaces, ManifestWorkspaceLoader, yarn.install
  └─→ ModuloUpdate  → clases/update   → init(clases/init), actualizarTodo, aplicarPatches, yarn.update
  └─→ ModuloAutoDoc → clases/auto-doc → TypeScript API, ManifestWorkspaceLoader, MySQL

Paquete → PaqueteStorage → GCS
Paquete → PaqueteDirectoryRoot → PaqueteDirectory → PaqueteFile
Paquete → push-log → subirLogHtmlPush → GCS (logs/{framework}/{fecha}/*.html)

utiles/diff  ← GestorTabla (tabla.ts), push-log.ts
utiles/tty   ← menu.ts (config/), GestorTabla (tabla.ts)
```

---

## Notas de convención

- Todas las funciones de módulo (`init`, `run`, `update`) reciben `basedir: string` como primer argumento (raíz absoluta del monorepo).
- Los flags de los módulos CLI se mapean 1:1 a sus interfaces `IDevel`, `IDeploy`, `IFramework`, etc.
- `actualizarTodo/enviarTodo/resetearTodo` retornan `Promise<boolean>` indicando si hubo cambios efectivos.
- La consola de progreso usa `Colors.up(N)` para sobreescribir líneas; `interceptarSalida` protege la TUI durante operaciones paralelas.
- Los logs de operaciones GCS se escriben en `{basedir}/tmp/log/` como ficheros Markdown.
- Los logs HTML de push se suben a GCS en `logs/{framework}/{version}.html` (nombre del framework sanitizado, `+` → `_` en la versión).
- El algoritmo LCS para diffs está centralizado en `utiles/diff.ts`; los consumidores solo añaden el formato de salida (ANSI o HTML).
- Las primitivas TTY (`Render`, `prepararTTY`, `restaurarTTY`) están centralizadas en `utiles/tty.ts`.
- Los ficheros `bin/min/*` se excluyen de los diffs HTML (mismo criterio que `GestorTabla.esDiffable` en `tabla.ts`).

## Refactorización 2026-07-03

- Eliminado código muerto confirmado: `clases/plugin/manager.ts`, `clases/plugin/template.ts` y `remove()` de `framework/cliente.ts` (ninguno tenía referencias en el resto de `@mr/cli/src`).
- Corregido bug de tipos real en `manifest/workspace/deployment/index.ts`: `Exclude<IManifestDeployment, "kustomize">` no elimina la propiedad de un tipo objeto (`Exclude` opera sobre uniones); sustituido por `Omit`.
- Corregidos nombres de parámetros copy-paste: `database.ts` usaba `imagen` como nombre de parámetro, `root/deploy/build.ts`/`run.ts` usaban `devel`.
- `mrpack.ts`: los módulos CLI (`autodoc`, `config`, `devel`, ...) ahora se definen en una única lista de metadatos (`MRPack.MODULOS: IModuloMeta[]`) en vez de estar duplicados en un array, un `switch` y el texto de ayuda por separado.
- Sustituidos los `new Promise(...)` por `Deferred<T>` en `config/menu.ts`, `workspace/i18n.ts` y `workspace/service.ts`.
- Extraído `Workspace.detenerProceso()` (en `clases/workspace.ts`) para eliminar la lógica duplicada de "spawn + timeout + `tree-kill`" que existía por separado en `I18N.stopCompilar`, `Service.stopCompilar` y `Service.stopEjecutar`.
- `devel.ts` reutiliza ahora `cargarConfig`/`GRUPOS` de `config/datos.ts` en vez de reimplementar la carga de `config.workspaces.json` y la lista de grupos; `deploy.ts` también usa `GRUPOS`, corrigiendo que antes no incluía el grupo `scripts`.
- Migrados los mensajes de progreso/error de `console.log`/`console.error` a la clase `Log` (`clases/log.ts`) en: `mrpack.ts` (solo el fatal-handler de `modulo.ts`, que se deja como excepción del propio runner), `manifest/index.ts`, `devel.ts`, `deploy.ts`, `patches.ts`, `yarn.ts`, `workspace/compilar.ts`, `init.ts`, `config/frameworks.ts`, `config/workspaces.ts`, `framework/cliente.ts`, `framework/gestor/index.ts`, `framework/gestor/acciones.ts`, `auto-doc.ts`. Se han respetado como excepción legítima los banners/ayuda de `mrpack.ts`/`modulos/*.ts`, los menús TUI de `config/menu.ts` y `framework/gestor/tabla.ts`, y el renderizado de progreso con control de cursor de `paquete/index.ts`.
- `Promise.reject()` sin `Error` sustituido por `throw new Error(...)` con contexto en `workspace/compilar.ts` (rspack/esbuild/next) y `framework/cliente.ts` (`getAutor`).
- Añadidas llaves faltantes en `if`/`for` sin bloque en `paquete/index.ts` y `paquete/file.ts`; eliminada una doble línea en blanco en `gestor/acciones.ts`; sustituidas comparaciones `==`/`!=` por `===`/`!==` en `framework/cliente.ts`.
- Catches silenciosos ahora loguean el error: `JSON.parse` en `gestor/acciones.ts`, `subirLogHtml()` en `gestor/acciones.ts`, `save()` en `manifest/index.ts`.

## Refactorización 2026-07-03 (fase 2 — deduplicación y división de módulos grandes)

- `framework/gestor/index.ts`: extraída la función `ejecutarTablaInteractiva()` compartida por `actualizarTodo`, `enviarTodo` y `resetearTodo` (mostrar `GestorTabla`, traducir el resultado indexado sobre `filtrados` de vuelta a un array indexado sobre `infos`, y loguear cancelación), eliminando ~30 líneas duplicadas 3 veces.
- `paquete/storage.ts`: extraído `ejecutarConLoginRetry<T>()`, que encapsula el patrón "ejecutar operación → si falla por auth reintentar tras `gcloud login` → si falla por 'No such object' devolver valor por defecto" antes duplicado entre `_fetchListaConLogin` y `getZIP()`.
- `auto-doc.ts`: eliminados todos los `any` explícitos (`querySchema`, `tsToJSON`, `resolveIdentifier`, `buildParameters`, `buildSchemaFromResponseObject`, ...), sustituidos por un tipo `JSONValue` y una interfaz `IEsquemaCampo`/`IEsquema` que modelan la forma real de los esquemas de validación de `services-comun`.
- `init.ts` (1141 → 498 líneas): dividido en 8 submódulos cohesivos bajo `clases/init/`: `git.ts` (`corregirGITs`/`corregirGIT`), `legacy.ts` (`limpiarLegacy`), `bundler.ts` → movido a `clases/bundler.ts` (compartido, ver más abajo), `scripts.ts` (`checkScripts`), `dependencias.ts` (`checkDependencies`, `resolverDepsTransitivas`, `versionMasReciente`, `mrNombreADir`), `symlinks.ts` (`initGithub`/`initAgents`), `yarnrc.ts` (`initYarnRC`/`IYarnRC`), `config-workspaces.ts` (`initConfig`/`IWorkspaces`/`sanitizePatch`). `init.ts` conserva solo la orquestación (`init`, `checkCliente`, `initBase`, `checkFiles`, `loadConfig`, `initWorkspace(s)`).
- **Dedup real encontrada durante la división**: `workspace/service.ts` tenía su propia copia (ligeramente distinta, sin chequeo de `reflect-metadata`) de `getBundlerCoherente`/`getBundlerNormalizado`, duplicada con la de `init.ts`. Unificadas en `clases/bundler.ts` (parámetro `dependencies` opcional), usado ahora por `init/scripts.ts`, `init.ts` y `workspace/service.ts`.
- `workspace/service.ts` (766 → 686 líneas): extraídas a `workspace/service-log-utils.ts` las funciones puras de formateo/parsing usadas para el log markdown de compilación: `horaLocal`, `fechaHoraLocal`, `extractFileRefs`. Al extraer `extractFileRefs` se corrigió un bug real de bucle infinito potencial: en la rama `rawPath.includes("node_modules")` se hacía `continue` sin haber avanzado `match = patron.exec(text)`, dejando el `while` en el mismo match para siempre.
- `framework/gestor/tabla.ts` (1280 → 1028 líneas): extraídas a `framework/gestor/diff-render.ts` (258 líneas) todas las funciones estáticas puras de cálculo/renderizado de diff, sin dependencia del estado de `GestorTabla`: `panelMagenta`, `lcsOps`, `alinearOps`, `renderCeldaDiff`, `calcularDiffSideBySide`, `calcularDiff`, `esDiffable`.
- No se ha dividido más `Service` ni `GestorTabla`: el resto de su lógica (spawn/timeout/watchers de procesos; navegación/dibujado interactivo del TUI) está fuertemente acoplada a estado de instancia mutable y es difícil de verificar sin pruebas manuales interactivas; se ha priorizado extraer solo las partes puras y de bajo riesgo.

## Refactorización 2026-07-03 (fase 3 — `Log` sin indentación de `console.group` y etiquetas anidadas)

- `clases/log.ts`: `Log.info`/`Log.error` escriben ahora directamente vía `process.stdout.write`/`process.stderr.write` (con `util.format`) en vez de `console.info`/`console.error`, para no heredar la indentación que añade `console.group()`/`console.groupEnd()` a cualquier llamada de `console.*` (mezclaba mal con el prefijo `[hora][tipo][label]` propio de `Log`).
- Se añade una pila de etiquetas (`pilaEtiquetas`) y una función `etiquetaCompuesta()`: en vez de indentar visualmente los bloques anidados, la propia etiqueta compone el camino de anidamiento, p.ej. `[init]` → `[init cliente]` → `[init cliente yarn]`. Si la etiqueta del grupo más interno coincide con la etiqueta de la llamada actual (caso típico: varias líneas seguidas dentro de la misma sección, como en `yarn.ts`), no se duplica (no aparece `"yarn yarn"`). Los corchetes `[ ]` del prefijo se colorean en morado (`Colors.FgMagenta`) para diferenciarlos visualmente del contenido.
- Nuevos métodos `Log.group(cfg, ...txt)` (loguea igual que `Log.info` con la etiqueta compuesta y apila `cfg.label`) y `Log.groupEnd()` (desapila). Sustituyen al patrón previo `Log.info(cfg, msg); console.group(); ...; console.groupEnd();` en los puntos donde `Log` delimitaba secciones anidadas: `init.ts`, `init/git.ts`, `init/legacy.ts`, `init/yarnrc.ts`, `init/config-workspaces.ts`, `yarn.ts` y los dos `console.groupEnd()` "huérfanos" de `framework/cliente.ts` (cierran un grupo abierto por `init.ts::checkCliente()` antes de `process.exit()`/de lanzar un error).
- No se ha tocado `console.group()`/`console.groupEnd()` en `mrpack.ts` ni en `modulos/*.ts`: ahí se usa solo para indentar texto de ayuda (`console.log` directo), sin relación con `Log`.

## Refactorización 2026-07-13 (limpieza de imports/`type` y división de `paquete/index.ts`)

- Revisión con `tsc --noEmit --noUnusedLocals --noUnusedParameters --isolatedModules --verbatimModuleSyntax` sobre todo `mrpack/`: eliminados imports no usados (`legacy.ts`) y convertidos a `import type`/especificador `type` varios imports usados solo como tipo (`deployment/imagen/index.ts`, `deployment/lambda/index.ts`, `modulos/auto-doc.ts`); renombrados parámetros no usados con el prefijo `_` (`modulo.ts::parsePositionals`, `mrpack.ts::parseParams`); eliminado el campo muerto `consolaEscribiendo` de `Paquete` (se asignaba pero nunca se leía).
- `clases/log.ts` / `clases/workspace/service-log-utils.ts`: `horaLocal`/`fechaHoraLocal` estaban duplicadas entre ambos ficheros; extraídas a `utiles/fecha.ts` (nuevo) y reexportadas donde hacía falta.
- `clases/workspace/i18n.ts`: eliminado un bloque de código comentado muerto (`// this.compilador.on("close", ...)`).
- `paquete/index.ts` (1073 → 847 líneas): dividido en 3 piezas cohesivas, siguiendo el mismo criterio de "extraer solo lo puro/de bajo acoplamiento" usado en la fase 2 con `Service`/`GestorTabla`:
  - `paquete/consola.ts` (nuevo): `ConsolaEstado`, `STATUS`, `IConsola` y la clase `PaqueteConsola`, que encapsula el estado de renderizado de la consola de progreso (antes 7 campos sueltos `consola*` en `Paquete`) con métodos `ajustarPadding()`, `configurarPosicion()`, `render()`, `formatVersionNueva()` y el getter `actual`.
  - `paquete/archivos-cambiados.ts` (nuevo): `EstadoArchivo`, `OrigenArchivo`, `IArchivoCambiado` y la función pura `combinarArchivosCambiados(locales, remotos)`, extraída de `getArchivosCambiadosCombinados()`. `paquete/index.ts` reexporta estos tres símbolos para no romper a los consumidores externos (`framework/gestor/tabla.ts`, `framework/gestor/diff-render.ts`), que siguen importándolos desde `"../../paquete"`.
  - `paquete/push-log.ts`: se le añade la función exportada `capturarDatosPush(...)`, movida tal cual desde el método privado `Paquete.capturarDatosPush` (solo usaba `this.basedir`/`this.nombre` del estado de instancia, por lo que era casi una función pura; encaja mejor junto al resto de lógica de `IPushLogData`).
  - No se ha tocado el resto de `Paquete` (`pull`, `push`, `reset`, `applyUpdate`, ciclo de vida de actualización): sigue fuertemente acoplado a estado mutable y E/S real (GCS, npm, disco), igual que se decidió para `Service`/`GestorTabla`.

