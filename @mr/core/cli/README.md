# `@mr/core-cli`

Infraestructura compartida por las dos herramientas de línea de comandos del monorepo:
**`mrpack`** (vive en `@mr/cli`) y **`mrlang`** (vive en `@mr/core-i18n`).

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

No contiene ningún comando. Contiene lo que las dos CLI necesitaban de la otra y que, mientras
compartieron workspace, era simplemente «un import relativo más»: el sistema de ficheros, el
logger, los colores de consola y la clase base de la que cuelga cada comando.

---

## Por qué existe

`mrlang` vivía dentro de `@mr/cli`, así que las dos CLI se repartían un mismo `src/`. Al separarlas
—cada una en su workspace— quedaban tres salidas para estos cinco ficheros: duplicarlos, o que una
CLI dependiera de la otra, o sacarlos a un sitio propio. Este paquete es la tercera.

La consecuencia práctica es la que se buscaba: **`@mr/cli` y `@mr/core-i18n` no se conocen**. Las
dos dependen de este paquete y de nadie más entre sí.

```text
@mr/core-cli          fs · log · colors · Modulo
   ▲              ▲
   │              │
@mr/cli        @mr/core-i18n
(mrpack)       (mrlang)
```

---

## Contenido

| Ruta | Qué es |
|------|--------|
| `@mr/core-cli/arranque` | El arranque de una CLI: ejecuta su bundle y, si no está, lo compila y reintenta |
| `@mr/core-cli/esbuild` | `compilar()`: la compilación de una CLI a `bin/min/`, con `tsc --noEmit` en paralelo |
| `@mr/core-cli/fs` | E/S de ficheros: `isDir`, `isFile`, `md5Dir`, `mkdir`, `readDir`, `readFile`, `readFileBuffer`, `readFileString`, `readJSON`, `readJSONSync`, `rmdir`, `safeWrite`, `unlink` |
| `@mr/core-cli/log` | `info`, `warning`, `error` |
| `@mr/core-cli/colors` | `Colors`: paleta ANSI **cíclica**, 21 combinaciones, para dar un color distinto a cada workspace en consola |
| `@mr/core-cli/colors/base` | `Colors`: los códigos ANSI sueltos, de los que hereda la cíclica |
| `@mr/core-cli/modulo` | `Modulo`, la clase base de un comando de CLI: parsea con `node:util/parseArgs` y delega en `parseParams` |

```js
// bin/mrpack.js — JavaScript plano, antes de que exista nada compilado
require("@mr/core-cli/arranque")({modulo: "mrpack", workspace: "@mr/cli", bin: __dirname});
```

```js
// src/esbuild.config.mjs — el config de cada CLI se queda en esto
import {compilar} from "@mr/core-cli/esbuild";

await compilar({url: import.meta.url, entry: {"mrlang": "main.ts"}, watch: process.argv.includes("--watch")});
```

```ts
import {readJSON, mkdir} from "@mr/core-cli/fs";
import {error, info} from "@mr/core-cli/log";
import {Colors} from "@mr/core-cli/colors";
import {Modulo, type IModulo, type IModuloConfig} from "@mr/core-cli/modulo";
```

Las rutas salen del mapa `exports` del `package.json`, así que **lo que no esté en el mapa no es
importable**, aunque el fichero exista.

---

## Dependencias

`tslib` en runtime, y `@types/node` y `esbuild` para construir. **Ni `services-comun` ni
`@mr/core-dev`**, que es deliberado: este paquete es la base de las dos CLI, y una base que
arrastra medio monorepo detrás no es una base.

`esbuild` entró con `esbuild.mjs`, y es la excepción razonada: el oficio de este paquete es
sostener las dos CLI, y compilarlas es parte de eso. `typescript` **no** entró, porque se resuelve
desde el paquete que llama.

Lo que costaba mantener esas dos dependencias eran cuatro cosas pequeñas, y las cuatro están ahora
aquí:

| Venía de | Qué era | Dónde está |
|----------|---------|------------|
| `services-comun/…/hash` | `md5()` | privada en `modules/fs.ts`, una línea sobre `node:crypto` |
| `services-comun/…/random` | `random()` | privada en `modules/fs.ts`, ocho líneas |
| `services-comun/…/promise` | `PromiseDelayed()` | privada en `modules/modulo.ts`, cuatro líneas |
| `@mr/core-dev` | el `tsconfig` base | inlineado en `tsconfig.json` |

El `tsconfig` **no extiende** el de `@mr/core-dev`: lleva escritas las opciones que aquella cadena
resolvía, menos los tipos globales del bundler (`PRODUCCION`, `ENTORNO`, …), que este código no
usa. El precio es que no se entera si el tsconfig base del monorepo cambia; el contrapeso es que
estos cinco ficheros se compilan también dentro de las dos CLI, que sí lo extienden, así que una
divergencia que importara saldría allí.

> **`random()` no es una copia literal.** El original hace `Math.round(Math.random()*62)` sobre un
> alfabeto de 62 caracteres, así que el índice 62 se sale y `charAt` devuelve `""`: una de cada
> quince cadenas sale más corta de lo pedido (1.285 de 20.000, medido), y con el redondeo el primer
> y el último carácter salen la mitad de veces que el resto. Aquí se usa para nombrar el fichero
> temporal de `safeWrite()`, donde lo que importa es no colisionar, así que la copia usa
> `Math.floor` y devuelve siempre la longitud pedida.

---

## `arranque.js` y `esbuild.mjs` son JavaScript, y tienen que serlo

Son los dos únicos ficheros del paquete que no son TypeScript. `arranque.js` lo carga el `bin/*.js` de cada CLI **antes de que exista nada compilado** —es
justamente quien dispara la compilación cuando falta el bundle—, y `esbuild.mjs` lo ejecuta `node`
directamente desde el `compile` de cada una. Ninguno de los dos puede depender de un paso de build.

Que estén aquí no da problemas: el `tsconfig` no lleva `allowJs`, así que no entran en la
compilación del paquete, y el `exports` apunta a ellos directamente.

**Los dos reciben de quién les llama su propia ubicación** —`bin` en uno, `url` en el otro— y no es
opcional: dentro del módulo compartido, `__dirname` e `import.meta.url` son los de `@mr/core-cli`,
no los de la CLI. De la `url` salen además su `package.json` (para los externals), su `tsconfig` y
la resolución de `typescript`, que por eso no hace falta declarar aquí.

---

## Dos cosas que conviene saber antes de tocarlo

**`fs` y `log` son forks deliberados de `services-comun`, no copias por descuido.** El original de
`log` arrastra `dd-trace` y la gestión de los modos `KUBERNETES`/`DATADOG`; el de `fs` lo arrastra
a través de él. Las CLI corren siempre en local o en CI, nunca dentro de un pod ni con el tracer
activo, así que aquí eso solo engordaba el bundle. Cada fork lleva escrito en su cabecera qué
funciones trae y por qué. Si hace falta una función que el fork no tiene, **se porta** — cambiar el
import al original reintroduce `dd-trace` y la dependencia entera, y nada lo delata.

**Hay un tercer `colors` que no es este.** `services-comun/modules/utiles/colors` existe y lo usan
tanto `mrpack` como `mrlang` en algún punto. El de aquí es el de las CLI y tiene el ciclo de
colores por workspace; el de `services-comun` no.

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.
