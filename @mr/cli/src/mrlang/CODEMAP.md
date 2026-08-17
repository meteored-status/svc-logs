# CODEMAP — `@mr/cli/src/mrlang/`

> Generado: 2026-08-13. Actualizar tras cambios significativos.
> Segmentado por bloques, siguiendo el mismo formato que
> [`@mr/core-network/CODEMAP.md`](../../../@mr/core/network/CODEMAP.md): tabla
> "Fichero | Símbolos exportados", sección "Símbolos" con firmas resumidas y diagrama de
> dependencias entre bloques al final.

`mrlang` es el binario de internacionalización del monorepo (`yarn mrlang <modulo>`, ver
[`@mr/cli/README.md`](../../README.md)). Gestiona el ciclo de vida de las traducciones: alta de
proyecto (`init`), descarga desde MySQL (`pull`), generación de clases TypeScript a partir de
JSON (`generate`), subida a MySQL (`push`) y corrección de metadatos remotos (`fremote`).

**Convive dos generaciones de generador** bajo el mismo comando `generate`:

| | `clases/` (v1, por defecto) | `clases-v2/` (v2, opt-in `--version=2`) |
|---|---|---|
| Formato de traducción | `Traduccion<T>` con 4 subtipos (`literal`/`map`/`plural`/`set`), persistidos también en MySQL | `JSONItem` con 3 tipos (`literal`/`map`/`set`, sin `plural` independiente — el plural vive dentro de `literal` como `JSONValuePlural`) |
| Persistencia | JSON (`i18n/.json/`) **y** MySQL (`pull`/`push`/`fremote` lo requieren) | Solo JSON — no tiene equivalente a `pull`/`push`/`fremote` |
| Runtime consumido | `services-comun/modules/traduccion/{literal,map,plural,set}` (v1) | `services-comun/modules/traduccion/v2/*` (`TranslationSet`, `TranslationMap`, `Literal`) |
| Selector | `clases/modulo/index.ts::Modulo` | `clases-v2/modulo/index.ts::Modulo` (interfaz más simple, sin persistencia) |

`pull`, `push`, `fremote` e `init` solo existen en v1: no han sido migrados a `clases-v2/`.

---

## Árbol de directorios

```
mrlang/
├── main.ts                    Entrypoint: instala source-maps, chdir ../.. y llama MRLang.run()
├── mrlang.ts                  Clase MRLang — punto de entrada CLI (submódulos fremote/generate/init/pull/push)
├── modulo.ts                  Modulo (abstract, extiende mrpack/Modulo) — cierra conexión MySQL al terminar
├── mysql.ts                   db — instancia MySQL.build() compartida (credenciales i18n/.credenciales/mysql.json)
│
├── modulos/                   Módulos CLI (parseo de flags, delegan en clases/ o clases-v2/ via import() dinámico)
│   ├── fremote.ts             ModuloFRemote  — `mrlang fremote`
│   ├── generate.ts            ModuloGenerate — `mrlang generate`  (elige v1/v2 según --version)
│   ├── init.ts                ModuloInit     — `mrlang init`
│   ├── pull.ts                ModuloPull     — `mrlang pull`
│   └── push.ts                ModuloPush     — `mrlang push`
│
├── clases/                    Generador v1 (JSON + MySQL)
│   ├── fremote.ts             FixRemote — refresca hash/versión de traducciones en MySQL
│   ├── generate.ts            Generate  — JSON → clases TS (vía plantillas de modulo/tmpl/)
│   ├── init.ts                Init      — crea el árbol i18n/ y registra el workspace
│   ├── pull.ts                Pull      — MySQL → JSON local
│   ├── push.ts                Push      — JSON local → MySQL
│   │
│   ├── idioma/
│   │   ├── index.ts           Idiomas    — jerarquía de fallback de idiomas (sin I/O)
│   │   └── loader.ts          IdiomasLoader extends Idiomas — carga desde JSON o MySQL + watch
│   │
│   └── modulo/
│       ├── index.ts           Modulo<T> (abstract) — nodo del árbol de módulos de traducción
│       ├── json.ts            ModuloJSON extends Modulo — variante persistida en `i18n/.json/`
│       ├── mysql.ts           ModuloMySQL extends Modulo — variante persistida en tabla `modulos`
│       │
│       ├── traduccion/
│       │   ├── index.ts       Traduccion<T> (abstract), TraduccionTipo, TraduccionOrigen
│       │   ├── literal/       TraduccionLiteral — valor simple (string), con o sin params
│       │   ├── map/           TraduccionMap     — diccionario clave→valor
│       │   ├── plural/        TraduccionPlural  — formas plurales por idioma
│       │   ├── set/           TraduccionSet     — colección de valores
│       │   └── loader/
│       │       ├── index.ts   TraduccionLoader, Traduccion (tipo unión), ITraduccionValues
│       │       ├── json.ts    TraduccionLoaderJSON — instancia subtipo según `tipo` (JSON)
│       │       └── mysql.ts   TraduccionLoaderMySQL — idem desde fila MySQL
│       │
│       └── tmpl/              Generadores de código fuente TS (funciones puras `(params) => string`)
│           ├── clase.ts               Clase agregadora de un módulo (con submódulos)
│           ├── interface.ts           Loader dinámico por idioma (import() con webpackChunkName)
│           ├── interface-bundle.ts    Loader estático (bundle, sin import() dinámico)
│           ├── langs.ts               Tipo `Langs`, `SOPORTADOS`, `check()`/`checkClean()` (selector idioma)
│           ├── loader.ts               Índice raíz — interfaz `ModuloLoader` + import dinámico
│           ├── loader-bundle.ts        Índice raíz — bundle estático
│           ├── loader-lang.ts           Índice de un idioma concreto — import dinámico
│           └── loader-lang-bundle.ts    Índice de un idioma concreto — bundle estático
│
├── clases-v2/                 Generador v2 (solo JSON; en migración, sin pull/push/fremote/init)
│   ├── data.ts                 JSONItem, JSONValue(Singular|Plural), JSONValor(Map|Set) — modelo del JSON fuente
│   ├── generate.ts             Generate — JSON → clases TS (con watch vía chokidar)
│   │
│   ├── lang/
│   │   ├── lang.ts              Lang — catálogo de idiomas con jerarquía parent/child
│   │   └── assets/langs.json    Catálogo de idiomas (code, parent_code)
│   │
│   ├── modulo/
│   │   ├── index.ts             Modulo<T> (abstract) — nodo simplificado (id + version, sin persistencia)
│   │   ├── json.ts               ModuloJSON extends Modulo — un módulo = un fichero .json plano
│   │   ├── definition.ts        Definition — genera `index.ts`/`bundle.ts` de definiciones compartidas por idioma
│   │   └── translation/
│   │       ├── common.ts        LANG_REGEXPS, definitionModulePath(), langModulePath()
│   │       ├── literal.ts       generateLiteral() — plantilla Literal (singular/plural)
│   │       ├── map.ts           generateMap()     — plantilla TranslationMap
│   │       └── set.ts           generateSet()     — plantilla TranslationSet
│   │
│   └── util/
│       └── case.ts               pascalCase()
│
└── (usa src/utiles/fs.ts y src/utiles/log.ts, ver @mr/cli/CODEMAP.md)
```

---

## Módulos raíz

### `main.ts`
```
Entrypoint. Instala source-map-support, hace chdir("../..") (sube de bin/min/ a la raíz
del monorepo) y delega en MRLang.run().
```

### `mrlang.ts` — `MRLang<T>`
```ts
export interface IMRLangConfig extends IModuloConfig {
    options: IModuloConfig["options"] & { version: {type:"string", short:"v", default:"1"} };
}
export interface IMRLang extends IModulo {}

export class MRLang<T extends IMRLangConfig> extends Modulo<T> {
    // Submódulos: "fremote" | "generate" | "init" | "pull" | "push"
    public static override run(): void
    protected override async parsePositionals(positionals: string[]): Promise<void>
    protected async parseParams(config: IMRLang, positionals: string[]): Promise<void>  // delega en ModuloXxx.run()
}
```
Reexporta `--version`/`-v` a nivel global (además de `--version` propio de `generate`), aunque
solo `generate` lo consume actualmente (selector v1/v2).

### `modulo.ts` — `Modulo<T>` (abstract, extiende `mrpack/modulo::Modulo`)
```ts
export abstract class Modulo<T extends IModuloConfig> extends ModuloBase<T> {
    public static override run<T>(modulo: Modulo<T>): void
    // PromiseDelayed().then(modulo.run()).catch(...).then(db.close())
    // Garantiza el cierre de la conexión MySQL compartida (mysql.ts) al terminar cualquier submódulo
}
```

### `mysql.ts`
```ts
const db: MySQL;  // MySQL.build({credenciales: "i18n/.credenciales/mysql.json"})
export default db;
```
Instancia única compartida por `pull`, `push`, `fremote` y los loaders MySQL de `clases/`.
`clases-v2/` no la importa (no tiene persistencia en base de datos).

---

## Módulos CLI (`modulos/`)

| Fichero | Clase | Flags CLI | Delega en (import dinámico) |
|---------|-------|-----------|------------------------------|
| `fremote.ts` | `ModuloFRemote` | _(ninguno propio)_ | `../clases/fremote → FixRemote.run()` |
| `generate.ts` | `ModuloGenerate` | `--watch`, `-v/--version` | `--version=2 → ../clases-v2/generate`; resto → `../clases/generate` |
| `init.ts` | `ModuloInit` | _(ninguno propio)_ | `../clases/init → Init.run()` |
| `pull.ts` | `ModuloPull` | _(ninguno propio)_ | `../clases/pull → Pull.run()` |
| `push.ts` | `ModuloPush` | _(ninguno propio)_ | `../clases/push → Push.run()` |

Todos los `import()` dinámicos llevan un comentario `webpackChunkName` (heredado del bundler
histórico rspack; con esbuild como bundler activo de `@mr/cli` — ver
[`@mr/cli/README.md#compilación-del-paquete`](../../README.md) — el comentario queda inerte
pero no afecta al bundle CJS único).

---

## Clases v1 (`clases/`) — generador JSON + MySQL

### `clases/generate.ts` — `Generate`
```ts
export class Generate {
    public static async run(basedir: string, watch: boolean): Promise<void>
    // 1. Lee i18n/package.json (IPackageConfig: lang, langs, modulos)
    // 2. Limpia i18n/.src/ y regenera cada ModuloJSON (config.modulos)
    // 3. Escribe langs.ts, index.ts, bundle.ts (raíz) + un índice/bundle por idioma en .src/<idioma>/
    // 4. Si watch: IdiomasLoader.addWatch() + Modulo.addWatch() por cada módulo (chokidar)
}
```
`generarMapping()` (privado): detecta idiomas cuyo contenido es idéntico en TODOS los módulos al
de otro idioma ya generado, para que el índice por-idioma apunte al idioma real en vez de
duplicar ficheros.

### `clases/pull.ts` — `Pull`
```ts
export class Pull {
    public static async run(basedir: string, nuevos?: string[]): Promise<void>
    // Requiere i18n/.credenciales/mysql.json
    // IdiomasLoader.fromMySQL() + ModuloMySQL.load() por cada id de config.modulos
    // Escribe i18n/.json/idiomas.json + un ModuloMySQL.toFile() por módulo
    // pullCheckModulos()/pullCheckModulo() (privados): añaden a config.modulos las entradas
    // "nuevas" pasadas por CLI (jerarquía id.split(".")), actualizando include/exclude
}
```

### `clases/push.ts` — `Push`
```ts
export class Push {
    public static async run(basedir: string): Promise<void>
    // Requiere i18n/.credenciales/mysql.json + i18n/.json/idiomas.json
    // ModuloJSON.load() por cada id de config.modulos → preparePush() → toMySQL()
}
```

### `clases/fremote.ts` — `FixRemote`
```ts
export class FixRemote {
    public static async run(basedir: string, ids?: string[]): Promise<void>
    // Sin ids: ModuloMySQL.getIDS() (todos los módulos raíz no borrados)
    // Por cada módulo: refreshHash() (recalcula hash real) + fixVersion() (persiste hash/version
    // sin pasar por guardar(), evitando reescribir el resto de columnas)
}
```

### `clases/init.ts` — `Init`
```ts
export class Init {
    public static async run(basedir: string): Promise<void>
    // Crea i18n/{.credenciales,.json,.run}/, i18n/.run/{generate,pull,push}.run.xml,
    // i18n/tsconfig.json, i18n/package.json (scripts generate/pull/push + config inicial)
    // Añade devDependencies.i18n="workspace:*" a cada workspace de packages/ y services/
    // Añade el script raíz "i18n": "yarn workspace i18n"
}
```

### `clases/idioma/index.ts` — `Idiomas`
```ts
export type TIdiomas = Record<string, string[]|undefined>;

export class Idiomas {
    public constructor(fallbacks: TIdiomas)
    public toJSON(): TIdiomas
    public getFallbacksUP(idioma: string): string[]    // idioma → sus fallbacks declarados (o los del "" por defecto)
    public getFallbacksDOWN(idioma: string): string[]  // idioma → idiomas que lo tienen a ÉL como fallback (jerarquía invertida, transitiva)
    public getKeys(): string[]
}
```
Sin I/O: modela la jerarquía de fallback en memoria. `getFallbacksDOWN()` calcula el cierre
transitivo de descendientes (`fallbacksDown`) una sola vez en `init()`.

### `clases/idioma/loader.ts` — `IdiomasLoader extends Idiomas`
```ts
export class IdiomasLoader extends Idiomas {
    public static async fromMySQL(): Promise<Idiomas>       // SELECT * FROM `idiomas`
    public static fromJSON(data: TIdiomas, version?: Date): IdiomasLoader
    public readonly version: Date
    public addWatch(basedir: string): void                   // chokidar sobre <basedir>/idiomas.json; recarga in-place con init()
}
```

### `clases/modulo/index.ts` — `Modulo<T>` (abstract)
```ts
export interface IModulo { id, padre?, descripcion, idiomas?, version, hash }
export interface IModuloConfig { nuevo: boolean }
export interface IPackageConfig { lang?, langs: string[], modulos: Record<string, {include?, exclude?}> }

export abstract class Modulo<T extends IModuloConfig=IModuloConfig> {
    public id, padre?, descripcion, idiomas: Idiomas, version, hash, jerarquia, submodulos, base_id, className
    public toJSON(): IModuloJSON
    public async refreshHash(): Promise<string>     // MD5 recursivo (traducciones + submódulos); marca cambio si difiere
    protected async load(): Promise<void>            // loadValues() + loadSubmodulos()
    protected async write(dir): Promise<void>        // _metadata.json + _values.json
    protected abstract loadValues(): Promise<Record<string, Traduccion|undefined>>
    protected abstract loadSubmodulos(): Promise<Modulo[]>
}
```
`className` se deriva de `id` vía `limpiarId()` (PascalCase, separando por `.`/`_`/`-`), y se
reutiliza como prefijo de las clases de `Traduccion` generadas para ese módulo.

### `clases/modulo/json.ts` — `ModuloJSON extends Modulo`
```ts
export interface IModuloJSON { id, descripcion?, idiomas?, version?, hash? }

export class ModuloJSON extends Modulo<IModuloConfig> {
    public static async load(jsondir: string, id: string, idiomas: Idiomas, paquete: IPackageConfig, padre?: ModuloJSON): Promise<ModuloJSON>
    // loadValues()/loadSubmodulos() leen de <jsondir>/<jerarquia>/{_values.json,_metadata.json} y subdirectorios
    // preparePush(): recalcula hash antes de subir a MySQL
    // toFile(basedir, config): escribe el árbol de clases TS (vía tmpl/) — usado por Generate
    // toMySQL(): persiste el módulo y sus traducciones en MySQL — usado por Push
}
```

### `clases/modulo/mysql.ts` — `ModuloMySQL extends Modulo`
```ts
export class ModuloMySQL extends Modulo<IModuloConfig> {
    public static async getIDS(): Promise<string[]>                                   // módulos raíz (padre IS NULL, borrado=0)
    public static async load(id: string, paquete: IPackageConfig, idiomas?: Idiomas): Promise<ModuloMySQL>
    // loadValues()/loadSubmodulos() hacen SELECT sobre `traducciones`/`modulos`
    // toFile(basedir, config): escribe i18n/.json/<jerarquia>/{_values.json,_metadata.json} — usado por Pull
}
```

### `clases/modulo/traduccion/index.ts` — `Traduccion<T>` (abstract)
```ts
export const enum TraduccionTipo { literal="literal", plural="plural", set="set", map="map" }
export const enum TraduccionOrigen { auto="auto", interno="interno", externo="externo" }
export interface ITraduccionData<T> { defecto: T; valor: Record<string, T|undefined> }
export interface ITraduccion<T> { origen, tipo, params?, data: ITraduccionData<T>, descripcion, idiomas?, version, hash }

export abstract class Traduccion<T> implements ITraduccionBase {
    public readonly modulo: Modulo; public readonly id: string
    public origen, tipo, params?, data, descripcion, idiomas, version, hash, className
    public toJSON(): ITraduccionJSON<T>
    public async refreshHash(): Promise<string>
    public async guardar(): Promise<void>            // INSERT ... ON DUPLICATE KEY UPDATE / UPDATE en tabla `traducciones`
    public async fixVersion(): Promise<void>         // UPDATE hash+version únicamente (usado por FixRemote)
    public async write(dir, jerarquia): Promise<void>  // escribe <id>.ts con template(); cachea contenido por jerarquía
    public getIdioma(idiomas: string[]): string|undefined   // primer idioma de la lista con valor propio (sin fallback)
    public abstract valores(jerarquia: string[]): T
    protected abstract templateNoParams(jerarquia): string
    protected abstract templateParams(jerarquia, params): string
}
```

### Subtipos de `Traduccion<T>` (`literal/`, `map/`, `plural/`, `set/`)

Los cuatro directorios siguen el mismo patrón de 3 ficheros:

| Fichero | Rol |
|---------|-----|
| `index.ts` | `Traduccion<Tipo>Values` (tipo del valor) + clase `Traduccion<Tipo> extends Traduccion<T>` — implementa `valores()` (resuelve por jerarquía de fallback) y delega `templateNoParams`/`templateParams` en `simple.ts`/`params.ts` |
| `simple.ts` | Plantilla (función pura) para la traducción **sin** parámetros — instancia directamente `new Traduccion<Tipo>({...})` |
| `params.ts` | Plantilla para la traducción **con** parámetros — genera además el tipo `<ClassName>Params` |

```ts
// literal/index.ts
export type ITraduccionLiteralValues = string;
export class TraduccionLiteral extends Traduccion<string> { ... }

// map/index.ts
export class TraduccionMap extends Traduccion<ITraduccionMapValues> { ... }

// plural/index.ts
export type ITraduccionPluralValues = Record<string,string> & {...};
export type ITraduccionPluralGenValues = Record<number,string> & {...};
export class TraduccionPlural extends Traduccion<ITraduccionPluralGenValues> { ... }

// set/index.ts
export class TraduccionSet extends Traduccion<ITraduccionSetValues> { ... }
```
El runtime instanciado por las plantillas (`TraduccionLiteral`/`TraduccionMap`/`TraduccionPlural`/
`TraduccionSet` **de `services-comun`**, no las clases de `mrlang` de arriba que solo existen en
tiempo de generación) vive en `services-comun/modules/traduccion/*`.

### `clases/modulo/traduccion/loader/`
```ts
// index.ts
export type ITraduccionValues = ITraduccionLiteralValues | ITraduccionPluralValues | ITraduccionSetValues | ITraduccionMapValues;
export type Traduccion = TraduccionBase<ITraduccionValues>;   // alias del tipo unión resuelto
export class TraduccionLoader {}   // clase base vacía; el trabajo real está en las subclases

// loader/json.ts
export interface ITraduccionJSON<T> { ... }
export class TraduccionLoaderJSON extends TraduccionLoader {
    public static build(modulo: Modulo, id: string, data: ITraduccionJSON, nuevo?: boolean): Traduccion
    // switch(data.tipo): instancia TraduccionLiteral/Map/Plural/Set según el campo `tipo`
}

// loader/mysql.ts
export interface ITraduccionMySQL<T> { ... }
export class TraduccionLoaderMySQL extends TraduccionLoader {
    public static build(modulo: Modulo, row: ITraduccionMySQL, nuevo?: boolean): Traduccion
    // mismo switch, pero deserializando columnas MySQL (params/data/idiomas como JSON string)
}
```

### `clases/modulo/tmpl/` — generadores de código fuente

Todas las plantillas son funciones puras `(parametros) => string` que devuelven el contenido
literal de un fichero `.ts` a escribir con `safeWrite()`. No tienen estado ni I/O propio.

| Fichero | Genera |
|---------|--------|
| `clase.ts` | La clase agregadora de un módulo (getters/campos por cada traducción + submódulos anidados) |
| `interface.ts` / `interface-bundle.ts` | Loader de un módulo por idioma: variante dinámica (`import()` + `webpackChunkName`) vs. bundle estático (todos los idiomas en un único fichero) |
| `loader.ts` / `loader-bundle.ts` | Índice raíz (`i18n/index.ts` / `i18n/bundle.ts`): interfaz `ModuloLoader` que agrupa todos los módulos |
| `loader-lang.ts` / `loader-lang-bundle.ts` | Índice de un idioma concreto (`i18n/.src/<idioma>/{index,bundle}.ts`) |
| `langs.ts` | Tipo `Langs` (unión de literales), `SOPORTADOS`, `check()`/`checkClean()` — selector de idioma con fallback a `defecto` |

**Depende de:** ninguna clase de negocio (funciones puras). **Usado por:** `ModuloJSON.toFile()`
y `Generate.run()` (los ficheros raíz `langs.ts`/`index.ts`/`bundle.ts`).

---

## Clases v2 (`clases-v2/`) — generador solo-JSON (en migración)

### `clases-v2/data.ts` — modelo del JSON fuente
```ts
export type TPluralKey = "zero"|"one"|"two"|"few"|"many"|"other";
export type TOrigen = "auto"|"interno";
export type TVariable = "literal"|"map"|"set";
export type TValue = "singular"|"plural";

export interface JSONItem { id, origen: TOrigen, tipo: TVariable, params?, values: {valor: Record<string,JSONValor>, defecto?} }
export interface JSONValue { type: TValue }
export interface JSONValueSingular extends JSONValue { type:"singular"; value:string }
export interface JSONValuePlural extends JSONValue { type:"plural"; value: Partial<Record<TPluralKey,string>> }
export interface JSONValorMap extends JSONValor { valores: Record<string, JSONValue> }
export interface JSONValorSet extends JSONValor { valores: JSONValue[] }
export interface JSONItemLiteral extends JSONItem { tipo:"literal"; ... }
export interface JSONItemMap extends JSONItem { tipo:"map"; ... }
export interface JSONItemSet extends JSONItem { tipo:"set"; ... }
```
A diferencia de v1, **no hay tipo `plural` independiente**: el plural es un `JSONValuePlural`
dentro de un `JSONItemLiteral` (`values.valor[lang].type === "plural"`).

### `clases-v2/generate.ts` — `Generate`
```ts
export class Generate {
    public static async run(basedir: string, watch: boolean): Promise<void>
    // Recorre recursivamente i18n/.json/ (loadModule) y por cada .json crea un ModuloJSON;
    // limpia i18n/.src/ y regenera langs/ (por idioma) + definitions/ (compartidas) con generateModule()
    // Si watch: un chokidar.watch() por fichero .json que regenera solo ese módulo al cambiar
}
```
No pasa por MySQL en ningún punto: `pull`/`push`/`fremote` siguen usando exclusivamente
`clases/` (v1). El flujo de datos es siempre `i18n/.json/**/*.json` (fuente editada a mano o
por `clases/pull` en v1) → `i18n/.src/{langs,definitions}/`.

### `clases-v2/modulo/index.ts` — `Modulo<T>` (abstract, simplificado)
```ts
export interface IModulo { id: string; version: number }
export interface IModuloConfig {}
export interface IPackageConfig { lang?: string; langs: string[] }

export abstract class Modulo<T extends IModuloConfig=IModuloConfig> {
    protected constructor(original: IModulo, config: T)
    protected get original(): IModulo
    public get id(): string
}
```
Sin `refreshHash`/`toJSON`/persistencia: la única implementación es `ModuloJSON` (no hay
equivalente a `ModuloMySQL`).

### `clases-v2/modulo/json.ts` — `ModuloJSON extends Modulo`
```ts
export interface IModuloJSON extends IModulo { traducciones: JSONItem[] }

export class ModuloJSON extends Modulo {
    public static async load(baseDir: string, file: string): Promise<ModuloJSON>
    public name(): string; public path(): string; public traducciones(): JSONItem[]
    public moduleLangs(): string[]                    // unión de idiomas presentes en cualquier traducción
    public generateLangIndex(): string                 // clase `<Modulo>` que implementa la interfaz del módulo
    public generateIndex(): string                     // interfaz TS del módulo (usada por definition.ts)
}
```

### `clases-v2/modulo/definition.ts` — `Definition`
```ts
export class Definition {
    public constructor(name: string, basedir: string, dir: string, langs: string[])
    public addParamDefinition(name: string, params: string[]): void
    public addRecordDefinitionEntry(name: string, key: string): void
    public set moduleInterface(content: string)
    public dir(): string; public path(): string
    public index(): string    // definitions/<módulo>/index.ts — tipos + loader dinámico import()
    public bundle(): string   // definitions/<módulo>/bundle.ts — loader estático (todos los idiomas embebidos)
}
```
Acumula, mientras se generan las traducciones de un módulo, los tipos de parámetros
(`addParamDefinition`) y las claves de `map`/`set` (`addRecordDefinitionEntry`) que después
emite en un único fichero de definiciones compartido por todos los idiomas de ese módulo.

### `clases-v2/modulo/translation/`
```ts
// common.ts
export const LANG_REGEXPS: {regex:RegExp; lang:string}[]     // normaliza es-XX→es, en-XX→en, pt→pt_PT, pt-BR→pt
export function definitionModulePath(module: ModuloJSON): string
export function langModulePath(modulePath: string, moduleName: string, lang: string): string

// literal.ts / map.ts / set.ts
export default (lang: string, value: ..., item: JSONItem, module: ModuloJSON, definition: Definition) => string
// Cada una es una función-plantilla que devuelve el .ts final para ese idioma/ítem, importando
// el runtime v2 correspondiente (services-comun/modules/traduccion/v2/*) y registrando tipos
// de parámetros/claves en `definition` cuando aplica
```

### `clases-v2/lang/lang.ts` — `Lang`
```ts
export class Lang {
    public static async getByCode(code: string): Promise<Lang>   // fallback a "en-US" si no existe; lanza si tampoco existe
    public get code(): string
    public get parentCode(): string|undefined
    public get parent(): Promise<Lang>|null                       // resuelve el idioma padre (jerarquía de fallback plural)
}
```
Catálogo cargado una única vez (caché estática) desde `lang/assets/langs.json`. Usado por
`generateModule()` (en `generate.ts`) para resolver el valor de un `literal` subiendo por la
jerarquía de idiomas cuando el idioma exacto no tiene traducción propia.

### `clases-v2/util/case.ts`
```ts
export const pascalCase: (str: string, regex?: RegExp) => string
```

---

## Grafo de dependencias (simplificado)

```
MRLang
  └─→ ModuloFRemote → clases/fremote  → ModuloMySQL, IdiomasLoader.fromMySQL, mysql.ts(db)
  └─→ ModuloGenerate → [--version=2] clases-v2/generate → ModuloJSON(v2), Definition, Lang,
      │                                                    translation/{literal,map,set}
      │                [default]     clases/generate    → ModuloJSON(v1), IdiomasLoader,
      │                                                    modulo/tmpl/{langs,loader,loader-bundle,
      │                                                    loader-lang,loader-lang-bundle}
  └─→ ModuloInit    → clases/init     → (sin dependencias de idioma/traduccion; solo fs + package.json)
  └─→ ModuloPull    → clases/pull     → IdiomasLoader.fromMySQL, ModuloMySQL, mysql.ts(db)
  └─→ ModuloPush    → clases/push     → IdiomasLoader.fromJSON, ModuloJSON(v1), mysql.ts(db)

clases/modulo/index (Modulo)
  ├─→ clases/modulo/json    (persistencia JSON)   ─┐
  ├─→ clases/modulo/mysql   (persistencia MySQL)  ─┼─→ clases/modulo/traduccion/loader/{json,mysql}
  └─→ clases/idioma/{index,loader}                 │      └─→ traduccion/{literal,map,plural,set}
                                                     └─→ clases/modulo/tmpl/* (solo desde json.ts::toFile())

clases-v2/modulo/index (Modulo, simplificado)
  └─→ clases-v2/modulo/json → clases-v2/modulo/translation/{literal,map,set} → clases-v2/lang/lang
                             → clases-v2/modulo/definition

Ambas generaciones → src/utiles/fs.ts (I/O) y src/utiles/log.ts (solo v2; v1 usa console.* directo)
mrlang/modulo.ts, mrlang/mysql.ts → compartidos por TODOS los módulos CLI (v1 y v2)
```

**Regla de aislamiento:** `clases-v2/` no importa nada de `clases/` (generaciones independientes
que solo comparten `mrlang/mysql.ts` — realmente ni eso, v2 no toca MySQL — y las utilidades de
`src/utiles/`). Al completar la migración de `pull`/`push`/`fremote`/`init` a v2, `clases/`
completo (y su flag `-v/--version=1` por defecto) podrá eliminarse.

---

## Notas de convención

- Todas las plantillas de código fuente (`clases/modulo/tmpl/*`, `clases-v2/modulo/translation/*`)
  son funciones puras sin estado; el único efecto secundario (escritura a disco) lo realiza
  siempre la clase `Modulo`/`Generate` que las invoca, nunca la plantilla misma.
- v1 seedea el hash de cambio (`refreshHash()`) tanto en `Modulo` como en `Traduccion`,
  comparando contra el `hash` persistido para decidir si debe avanzar `version` — patrón
  reutilizado también en `@mr/cli/src/mrpack/clases/paquete/` (`Paquete`/`PaqueteFile`) para el
  hash de ficheros de framework, aunque son implementaciones independientes.
- `clases-v2/` usa JSDoc en las clases nuevas (`Lang`, `ModuloJSON`); `clases/` (código legado)
  no lo hace de forma consistente.
