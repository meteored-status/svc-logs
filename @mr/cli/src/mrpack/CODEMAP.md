# CODEMAP — `@mr/cli/src/mrpack/`

> Generado: 2026-06-26. Actualizar tras cambios significativos. Última revisión: 2026-06-26 (optimización push-log).

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
│   │   ├── menu.ts                  seleccionar/elegirUno/alternarLista — primitivas TUI readline
│   │   │                            (Render y helpers TTY importados de utiles/tty.ts)
│   │   ├── datos.ts                 cargarConfig/guardarConfig/listarWorkspacesConInfo/existeI18n
│   │   ├── workspaces.ts            gestionarWorkspaces() — submenú compilar/ejecutar/i18n
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
| `devel.ts` | `ModuloDevel` | `-c/--compilar`, `-e/--ejecutar`, `-f/--forzar` | `clases/devel.ts → run()` |
| `framework.ts` | `ModuloFramework` | `-u/--update`, `-r/--reset`, `-s/--send`, `-y/--yes` | `clases/framework → actualizarTodo/resetearTodo/enviarTodo/gestionar` |
| `init.ts` | `ModuloInit` | _(ninguno extra)_ | `clases/init.ts → init()` |
| `update.ts` | `ModuloUpdate` | _(ninguno extra)_ | `clases/update.ts → init()` |

---

## Clases principales

### `clases/workspace.ts` — `Workspace`
```ts
export interface IWorkspace { nombre: string; path?: string; root: string; }

export class Workspace {
    public addHijo(ws: Workspace): void
    public async init(): Promise<void>      // run() + initWatcher(); idempotente
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
export interface IConfigServices {
    devel: {available:string[];disabled:string[]};
    packd: {available:string[];disabled:string[]};
    i18n: boolean;
    services: Record<string,string>;
    framework?: {updates: FrameworkUpdates};
    patch?: string;
}
// Service: lanza/reinicia el proceso del servicio con spawn; respeta config.workspaces.json
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
    // Lanza `mrlang generate --watch`; se reinicia ante cambios .json
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
// Menú principal de `mrpack config`. Opciones: "Gestionar workspaces" → gestionarWorkspaces()
```

### `workspaces.ts`
```ts
export async function gestionarWorkspaces(basedir:string): Promise<void>
// Submenú: Compilar (packd.available/disabled) · Ejecutar (devel.available/disabled)
//          · Generar i18n (elegirUno ON/OFF; solo si existe el workspace i18n)
```

### `frameworks.ts`
```ts
export async function gestionarFrameworks(basedir:string): Promise<void>
// Submenú: Autoupdates (elegirUno de framework.updates: all/daily/weekly)
//          · Sistema de Patches (elimina config.patch para forzar reaplicación)
```

### `datos.ts`
```ts
export interface IInfoWorkspace { nombre:string; compilable:boolean; ejecutable:boolean }
export async function cargarConfig(basedir:string): Promise<IConfigServices>           // lee con defaults
export async function guardarConfig(basedir:string, config:IConfigServices): Promise<void>  // normaliza + safeWrite
export async function listarWorkspacesConInfo(basedir:string): Promise<IInfoWorkspace[]>    // lee mrpack.json de cada workspace
// compilable = runtime !== "php" | ejecutable = framework === "meteored" && runtime === "node"
export async function existeI18n(basedir:string): Promise<boolean>
```

### `menu.ts` — primitivas TUI readline
```ts
export interface IMenuOpcion<T> { label:string; value:T; descripcion?:string; disabled?:boolean }
export interface IToggleItem { label:string; checked:boolean }
export async function seleccionar<T>(titulo:string, opciones:IMenuOpcion<T>[], config?:{inicial?:number}): Promise<T|null>
export async function elegirUno<T>(titulo:string, opciones:IMenuOpcion<T>[], config?:{inicial?:number}): Promise<T|null>
export async function alternarLista(titulo:string, items:IToggleItem[]): Promise<boolean[]|null>
// Render, prepararTTY, restaurarTTY importados de utiles/tty.ts
// Modo raw + redibujado con Colors.up; ↑↓ navegar, Espacio/←→ alternar, Intro confirmar, Esc cancelar
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
export interface IConfigEjecucion { compilar:boolean; ejecutar:boolean; forzar:boolean; }
export function run(basedir:string, config:IConfigEjecucion): void
// Si compilar: init + actualizarTodo + install
// Siempre: ejecutarWorkspaces(@mr/core,@mr/user,framework,packages) → ejecutarServices(cronjobs,jobs,scripts,services)
// Watcher sobre config.workspaces.json para recargar en caliente
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

