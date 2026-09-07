# CODEMAP — `@mr/core-i18n/src/`  (`mrlang`)

> Generado: 2026-08-13. Actualizar tras cambios significativos.
> **El código vivía en `@mr/cli/src/mrlang/` hasta el 2026-09-04**; las rutas de este documento
> son ya las nuevas. Si algo enlaza a la vieja, está caducado.
> Segmentado por bloques, siguiendo el mismo formato que
> [`@mr/core-network/CODEMAP.md`](../../network/CODEMAP.md): tabla
> "Fichero | Símbolos exportados", sección "Símbolos" con firmas resumidas y diagrama de
> dependencias entre bloques al final.

`mrlang` es el binario de internacionalización del monorepo (`yarn mrlang <modulo>`, ver
[`@mr/core-i18n/README.md`](../README.md)). **Dos comandos**: `init`, que da de alta el proyecto de
traducciones, y `generate`, que produce las clases TypeScript a partir de los JSON.

> **Hubo tres más —`pull`, `push` y `fremote`— y se retiraron el 2026-09-04 junto con todo MySQL.**
> Eran del generador v1, que además de en JSON persistía las traducciones en una base de datos; ya
> no se usaba. Se fueron diez ficheros, tres dependencias npm (`mysql2`, `dd-trace` y
> `@ungap/structured-clone`, que entraban por `services-comun/modules/database/mysql`) y 24 kB del
> bundle, que pasó de 86,3 a 62,3 kB.

**Conviven dos generaciones de generador** bajo el mismo comando `generate`:

| | `clases/` (v1, por defecto) | `clases-v2/` (v2, opt-in `--version=2`) |
|---|---|---|
| Formato de traducción | `Traduccion<T>` con 4 subtipos (`literal`/`map`/`plural`/`set`) | `JSONItem` con 3 tipos (`literal`/`map`/`set`, sin `plural` independiente — el plural vive dentro de `literal` como `JSONValuePlural`) |
| Persistencia | JSON (`i18n/.json/`) | JSON (`i18n/.json/`) |
| Runtime consumido | `services-comun/modules/traduccion/{literal,map,plural,set}` (v1) | `services-comun/modules/traduccion/v2/*` (`TranslationSet`, `TranslationMap`, `Literal`) |
| Selector | `clases/modulo/index.ts::Modulo` | `clases-v2/modulo/index.ts::Modulo` (interfaz más simple) |

`init` solo existe en v1: no ha sido migrado a `clases-v2/`.

**Las dos generaciones son ya solo-JSON**, que era lo que las distinguía de verdad. Lo que las
sigue separando es el formato del `.json` y el runtime que consumen.

---

## Árbol de directorios

```
mrlang/
├── main.ts                    Entrypoint: instala source-maps, chdir ../.. y llama MRLang.run()
├── mrlang.ts                  Clase MRLang — punto de entrada CLI (submódulos generate/init)
│
├── modulos/                   Módulos CLI (parseo de flags, delegan en clases/ o clases-v2/ via import() dinámico)
│   ├── generate.ts            ModuloGenerate — `mrlang generate`  (elige v1/v2 según --version)
│   └── init.ts                ModuloInit     — `mrlang init`
│
├── clases/                    Generador v1 (solo JSON)
│   ├── generate.ts            Generate  — JSON → clases TS (vía plantillas de modulo/tmpl/)
│   ├── init.ts                Init      — crea el árbol i18n/ y registra el workspace
│   │
│   ├── idioma/
│   │   ├── index.ts           Idiomas    — jerarquía de fallback de idiomas (sin I/O)
│   │   └── loader.ts          IdiomasLoader extends Idiomas — carga desde JSON + watch
│   │
│   └── modulo/
│       ├── index.ts           Modulo<T> (abstract) — nodo del árbol de módulos de traducción
│       ├── json.ts            ModuloJSON extends Modulo — variante persistida en `i18n/.json/`
│       │
│       ├── traduccion/
│       │   ├── index.ts       Traduccion<T> (abstract), TraduccionTipo, TraduccionOrigen
│       │   ├── literal/       TraduccionLiteral — valor simple (string), con o sin params
│       │   ├── map/           TraduccionMap     — diccionario clave→valor
│       │   ├── plural/        TraduccionPlural  — formas plurales por idioma
│       │   ├── set/           TraduccionSet     — colección de valores
│       │   └── loader/
│       │       ├── index.ts   TraduccionLoader, Traduccion (tipo unión), ITraduccionValues
│       │       └── json.ts    TraduccionLoaderJSON — instancia subtipo según `tipo` (JSON)
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
│   │       ├── idiomas.ts       avisosDeIdioma() — entradas a las que les falta un idioma que el resto sí tiene
│   │       ├── plural.ts        tienePlural(), problemasDePlural(), avisosDePlural(), argumentoCounter() — el contador de un plural
│   │       ├── valor.ts         emitirValor() — escribe UN SingularValue/PluralValue; lo comparten los tres
│   │       ├── literal.ts       generateLiteral() — envuelve un valor en Literal
│   │       ├── map.ts           generateMap()     — envuelve varios en TranslationMap, por clave
│   │       └── set.ts           generateSet()     — envuelve varios en TranslationSet, ordenados
│   │
│   │   Los tres se diferencian **solo en qué envuelven**. Lo que declara el valor está en `valor.ts`
│   │   y no copiado tres veces, que es lo que los hizo divergir: `set.ts` no pasaba `params` al
│   │   `SingularValue` y `literal.ts` copió una variable de su propia rama del singular. Las dos
│   │   veces compilaba y fallaba en pantalla.
│   │
│   └── util/
│       └── case.ts               pascalCase()
│
└── (usa @mr/core-cli/{fs,log,colors,modulo}, ver @mr/core/cli/CODEMAP.md)
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

### La clase base de los comandos

`mrlang` tenía un `modulo.ts` propio que extendía `@mr/core-cli/modulo::Modulo` **solo para cerrar
la conexión MySQL** al terminar. Sin MySQL no aportaba nada, así que se borró: `MRLang`,
`ModuloGenerate` y `ModuloInit` extienden hoy directamente la clase de `@mr/core-cli`.

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
histórico rspack; con esbuild como bundler activo — ver
[`@mr/core-i18n/README.md#compilación`](../README.md) — el comentario queda inerte
pero no afecta al bundle CJS único).

---

## Clases v1 (`clases/`) — generador solo-JSON

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

### `clases/init.ts` — `Init`
```ts
export class Init {
    public static async run(basedir: string): Promise<void>
    // Crea i18n/{.json,.run}/, i18n/.run/generate.run.xml,
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
    // toFile(basedir, config): escribe el árbol de clases TS (vía tmpl/) — usado por Generate
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
    public static build(modulo: Modulo, id: string, data: ITraduccionJSON): Traduccion
    // switch(data.tipo): instancia TraduccionLiteral/Map/Plural/Set según el campo `tipo`
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

export interface JSONItem { id, origen: TOrigen, tipo: TVariable, params?, counter?, values: {valor: Record<string,JSONValor>, defecto?} }
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
dentro de un `JSONItemLiteral` (`values.valor[lang].type === "plural"`) — o dentro de un `map` o un `set`, que
también admiten valores plurales.

`counter` dice **cuál de los `params` es el número que decide la forma del plural**. Es opcional porque con un
único parámetro se deduce que es ese, y así los módulos escritos antes de que el campo existiera siguen
generándose sin tocarlos; con dos o más es obligatorio, porque nada dice que el contador sea el primero. Lo
comprueba `ModuloJSON.validar()` — ver `translation/plural.ts`.

### `clases-v2/modulo/translation/plural.ts` — el contador de un plural

```ts
export const tienePlural = (item: JSONItem): boolean
export const problemasDePlural = (item: JSONItem): string[]
export const avisosDePlural = (item: JSONItem): string[]
export const argumentoCounter = (item: JSONItem): string
```

Vive aparte de los tres emisores porque los tres lo necesitan igual —una entrada `literal`, `map` o `set` puede
llevar plurales dentro— y porque la validación tiene que poder preguntarlo **sin generar nada**.

`tienePlural()` mira **todos** los valores de la entrada, los de cada idioma y el del defecto, y en un `map` o un
`set` también los de dentro: basta que un idioma tenga forma plural para que la entrada necesite contador.

`problemasDePlural()` es la tabla de validación:

| `params` | `counter` | resultado |
|---|---|---|
| 0 | — | error: no hay ningún número con el que elegir la forma |
| 1 | ausente | se deduce que el contador es ese |
| 1 o más | presente pero no está en `params` | error: es el fallo de dedo que antes volvía a fallar en silencio |
| 2 o más | ausente | error: hay que declarar cuál es el contador |

`avisosDePlural()` detecta lo que la tabla de arriba **no puede** ver: un `counter` que existe, está entre los
`params` y aun así no es el número con el que concuerda la frase. Ahí no falla nada — el runtime elige la forma
por el número equivocado y sale «1 de 30 días» o «5 de 1 día» sin un solo error—, así que es el fallo que llega
a producción.

Cómo lo adivina: la concordancia se ve en **lo que cambia** de una forma a la otra. En «{{n}} de {{total}} día»
contra «{{n}} de {{total}} días» lo único que cambia es «día», y el número que lo gobierna es el hueco que tiene
al lado, `total`. Así que recorta el prefijo y el sufijo comunes y busca el hueco más cercano a lo que queda en
medio: si está dentro de la diferencia es ese, y si no, el más próximo por fuera, con empate a la izquierda —que
es donde lo ponen los tres idiomas del panel («2 días», no «días 2»)—.

**No avisa** cuando la pista no es fiable: formas idénticas, una diferencia que abarca varios huecos, o ningún
hueco del que tirar. Es deliberado: esto es una heurística sobre lenguaje natural, y un falso positivo cuesta
más que un despiste sin detectar porque enseña a ignorar los avisos.

Por eso mismo **va por un canal aparte y no corta la generación**: `ModuloJSON.avisos()` los recoge y
`Generate.run()` los imprime con `warning()` **después** de comprobar los errores. `validar()` comprueba datos
que faltan y es un error; esto adivina intención y es un aviso.

Medido sobre los módulos del proyecto: **1.048 entradas, 0 avisos**; y dando la vuelta al `counter` de las ocho
entradas que tienen varios parámetros, **las 15 combinaciones erróneas salen todas**.

`argumentoCounter()` emite el cuarto argumento de `PluralValue` **solo cuando la entrada lo declara**: con un
único parámetro el runtime lo deduce igual, y no emitirlo deja byte a byte iguales los ficheros de los módulos
que ya existían.

### `clases-v2/modulo/translation/idiomas.ts` — los idiomas de un módulo

```ts
export const avisosDeIdioma = (items: JSONItem[]): {id: string; aviso: string}[]
```

Avisa de las entradas a las que **les falta un idioma que el resto del módulo sí tiene**. Es el fallo que no
delata nadie: `mrlang generate` no se queja de un idioma ausente, el runtime cae al defecto, y la pantalla sale
**medio traducida**. Compila, se despliega, y solo lo ve quien la use en ese idioma — que en un panel interno
puede ser nadie durante meses. Pasó de verdad: treinta cadenas nuevas escritas en tres idiomas cuando el
proyecto tiene cuatro.

**Se compara contra los idiomas que el propio módulo tiene, no contra una lista fija**, y esa es la decisión
que lo hace usable. Un `.json` no declara en qué idiomas está, así que el módulo se declara a sí mismo con la
unión de lo que traen sus entradas: un módulo escrito entero en dos idiomas **no avisa de nada**, porque eso es
una decisión y no un olvido. Lo que se detecta es la **incoherencia dentro del módulo** — cuarenta y cuatro
entradas con catalán y una sin.

Va por el mismo canal que `avisosDePlural()` (`ModuloJSON.avisos()` → `warning()`) y **no corta la
generación**: traducir un módulo entrada a entrada es un estado legítimo mientras se está haciendo, y romperle
el build a quien está en mitad de eso es la forma más rápida de que alguien lo desactive.

Comprobado de las tres maneras que hacían falta: con el proyecto como está no dice nada (1.078 entradas);
quitando el catalán de dos entradas de `page.user` avisa de las dos y sale con código 0; y quitando el catalán
de **todas** las de `page.login` se calla, que es la que evita que el aviso sea un incordio.

### `clases-v2/generate.ts` — `Generate`

**La jerarquía de idiomas la resuelve `resolverValor()`, y la usan los tres tipos.** Para un idioma dado sube
por la cadena del catálogo (`es-ES` → `es` → `en` → `en-US`) antes de rendirse al `defecto` de la entrada. Vivía
suelta dentro del `case "literal"`, así que un `map` o un `set` hacían `valor[lang] ?? defecto` y se saltaban la
herencia entera — con los idiomas de hoy daba igual, porque el defecto es inglés y la cadena de `es` acaba en
inglés, pero un idioma con padre distinto del defecto habría partido la pantalla en dos.

**Valida antes de tocar el `.src`.** `run()` carga los módulos, junta lo que devuelva `validar()` de cada uno y,
si hay algo, lo escribe con `error()` y rechaza **sin generar nada** — antes el borrado del `.src` era lo
primero, así que un `.json` mal escrito dejaba el workspace sin nada generado.

**Y no borra `.src`: genera encima y poda al final** (`limpiarHuerfanos()`). Borrarlo en bloque dejaba el
directorio incompleto durante toda la generación, y en ese hueco cualquiera que compile —un `tsc`, el
`next dev` de otra terminal, otra sesión de trabajo— se lleva decenas de «Cannot find module» sobre ficheros
que existían hace un segundo y van a volver a existir. Pasó de verdad, y cuesta un rato entenderlo porque el
error no señala a quien lo provocó.

Generando encima, lo peor que puede ver quien lea a la vez es un fichero con el contenido **anterior**, que
compila. Y el orden de escritura ya lo permitía sin saberlo: `generateModule()` escribe las claves de un
idioma **antes** que su `index.ts`, así que un índice nunca apunta a un fichero que todavía no está.

`limpiarHuerfanos()` recorre `.src` al final y quita lo que no se acaba de escribir —una entrada borrada del
`.json`, un idioma retirado, un módulo entero que ya no existe—; primero los ficheros y después los
directorios de más profundo a menos, para que uno que se queda vacío se vaya en la misma pasada. Para eso
`generateModule()` **devuelve las rutas que ha escrito**; quien lo llama desde el watch las ignora, porque ahí
no se poda nada.

Comprobado sobre los 4.406 ficheros generados del proyecto: el resultado es **byte a byte el mismo** que con
el borrado en bloque. Y comprobado que la poda poda, que es lo que el borrado hacía gratis: quitando una clave
de un `.json` desaparece su fichero en los tres idiomas, y retirando un módulo entero desaparecen sus cuatro
directorios.

```ts
export class Generate {
    public static async run(basedir: string, watch: boolean): Promise<void>
    // Recorre recursivamente i18n/.json/ (loadModule) y por cada .json crea un ModuloJSON;
    // genera langs/ (por idioma) + definitions/ (compartidas) con generateModule(), encima de lo que
    // hubiera, y al final limpiarHuerfanos() quita de i18n/.src/ lo que ya no genera nadie
    // Si watch: un chokidar.watch() por fichero .json que regenera solo ese módulo al cambiar
}
```
El flujo de datos es siempre `i18n/.json/**/*.json`, editado a mano →
`i18n/.src/{langs,definitions}/`.

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
Sin `refreshHash`/`toJSON`: la única implementación es `ModuloJSON`. Sigue siendo más simple que
el `Modulo` de v1, que conserva el hash y la versión de cada entrada.

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
  └─→ ModuloGenerate → [--version=2] clases-v2/generate → ModuloJSON(v2), Definition, Lang,
      │                                                    translation/{literal,map,set}
      │                [default]     clases/generate    → ModuloJSON(v1), IdiomasLoader,
      │                                                    modulo/tmpl/{langs,loader,loader-bundle,
      │                                                    loader-lang,loader-lang-bundle}
  └─→ ModuloInit    → clases/init     → (sin dependencias de idioma/traduccion; solo fs + package.json)

clases/modulo/index (Modulo)
  ├─→ clases/modulo/json    (persistencia JSON)  ──→ clases/modulo/traduccion/loader/json
  └─→ clases/idioma/{index,loader}                     └─→ traduccion/{literal,map,plural,set}
                                                   └─→ clases/modulo/tmpl/* (solo desde json.ts::toFile())

clases-v2/modulo/index (Modulo, simplificado)
  └─→ clases-v2/modulo/json → clases-v2/modulo/translation/{literal,map,set} → clases-v2/lang/lang
                             → clases-v2/modulo/definition

Ambas generaciones → @mr/core-cli/fs (I/O) y @mr/core-cli/log (solo v2; v1 usa console.* directo)
```

**Regla de aislamiento:** `clases-v2/` no importa nada de `clases/` (generaciones independientes
que solo comparten las utilidades de `@mr/core-cli`). Al completar la migración de `init` a v2,
`clases/` completo (y su flag `-v/--version=1` por defecto) podrá eliminarse — que ahora es un
paso más corto, porque `pull`/`push`/`fremote` ya no están.

---

## Notas de convención

- Todas las plantillas de código fuente (`clases/modulo/tmpl/*`, `clases-v2/modulo/translation/*`)
  son funciones puras sin estado; el único efecto secundario (escritura a disco) lo realiza
  siempre la clase `Modulo`/`Generate` que las invoca, nunca la plantilla misma.
- v1 seedea el hash de cambio (`refreshHash()`) tanto en `Modulo` como en `Traduccion`,
  comparando contra el `hash` persistido para decidir si debe avanzar `version` — patrón
  reutilizado también en `@mr/cli/src/clases/paquete/` (`Paquete`/`PaqueteFile`, otro workspace) para el
  hash de ficheros de framework, aunque son implementaciones independientes.
- `clases-v2/` usa JSDoc en las clases nuevas (`Lang`, `ModuloJSON`); `clases/` (código legado)
  no lo hace de forma consistente.
