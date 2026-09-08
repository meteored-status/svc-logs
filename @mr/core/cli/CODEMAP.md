# CODEMAP - `@mr/core-cli`

Mapa tecnico del workspace `@mr/core/cli/`.

## Objetivo

Alojar lo que comparten las dos herramientas de linea de comandos del monorepo, `mrpack`
(`@mr/cli`) y `mrlang` (`@mr/core-i18n`), para que ninguna de las dos dependa de la otra.

No define ningun comando: solo la infraestructura sobre la que se escriben.

## Arbol de modulos

```text
@mr/core/cli/
├─ arranque.js         arranque de una CLI — JS plano, NO TypeScript
├─ esbuild.mjs         compilacion de una CLI — JS plano, NO TypeScript
├─ modules/
│  ├─ colors/
│  │  ├─ base.ts     codigos ANSI sueltos
│  │  └─ index.ts    paleta ciclica por workspace, hereda de base
│  ├─ fs.ts          E/S de ficheros (fork de services-comun)
│  ├─ log.ts         info / warning / error (fork de services-comun)
│  └─ modulo.ts      clase base de un comando de CLI
├─ README.md
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json
└─ tsconfig.json
```

Siete ficheros: cinco en TypeScript (461 lineas) mas `arranque.js` y `esbuild.mjs`. El paquete es intencionadamente pequeno: es la frontera entre las
dos CLI, no un cajon de utilidades.

## Superficie publica

Cinco rutas, todas declaradas en el mapa `exports` del `package.json`:

| Ruta | Fichero | Exporta |
|------|---------|---------|
| `@mr/core-cli/arranque` | `arranque.js` | La funcion de arranque de una CLI (CommonJS) |
| `@mr/core-cli/esbuild` | `esbuild.mjs` | `compilar()`, la compilacion de una CLI (ESM) |
| `@mr/core-cli/fs` | `modules/fs.ts` | `isDir`, `isFile`, `md5Dir`, `mkdir`, `readDir`, `readFile`, `readFileBuffer`, `readFileString`, `readJSON`, `readJSONSync`, `rmdir`, `safeWrite`, `unlink` |
| `@mr/core-cli/log` | `modules/log.ts` | `info`, `warning`, `error` |
| `@mr/core-cli/colors` | `modules/colors/index.ts` | `Colors` (ciclica) |
| `@mr/core-cli/colors/base` | `modules/colors/base.ts` | `Colors` (base) |
| `@mr/core-cli/modulo` | `modules/modulo.ts` | `Modulo`, `IModulo`, `IModuloConfig` |

**Clave sin extension, destino con ella**, que es el patron del resto de la familia
(`@mr/core-utils`, `@mr/core-dev`, `@mr/core-i18n`). Declarar `exports` **cierra** el paquete: un
modulo nuevo en `modules/` no se ve desde fuera hasta que se anade su clave.

## Detalle de implementacion

### Sin dependencias, a proposito

`tslib` y nada mas: **ni `services-comun` ni `@mr/core-dev`**. Es la base sobre la que se escriben
las dos CLI, y una base que arrastra el resto del monorepo detras deja de serlo.

Lo que se importaba de fuera eran cuatro cosas pequenas, hoy locales:

| Venia de | Que era | Donde esta ahora |
|----------|---------|------------------|
| `services-comun/…/hash` | `md5()` | privada en `modules/fs.ts` — una linea sobre `node:crypto` |
| `services-comun/…/random` | `random()` | privada en `modules/fs.ts` — ocho lineas |
| `services-comun/…/promise` | `PromiseDelayed()` | privada en `modules/modulo.ts` — cuatro lineas |
| `@mr/core-dev` | el `tsconfig` base | inlineado en `tsconfig.json` |

Ninguna de las tres se reexporta: son privadas de su fichero, asi que la superficie publica del
paquete no cambia.

**`random()` no es copia literal.** El original hace `Math.round(Math.random()*62)` sobre un
alfabeto de 62 caracteres: el indice 62 se sale y `charAt` devuelve `""`, asi que una de cada
quince cadenas sale mas corta de lo pedido —1.285 de 20.000, medido— y el primer y el ultimo
caracter salen la mitad de veces que el resto. Se usa para nombrar el temporal de `safeWrite()`,
donde lo que importa es no colisionar, asi que la copia usa `Math.floor` y devuelve siempre la
longitud pedida. `md5()` si es identica, que importa: de ella salen los hashes con los que
`mrpack framework` decide si un paquete ha cambiado.

**El `tsconfig` no extiende el de `@mr/core-dev`.** Lleva escritas las opciones que aquella cadena
(`@mr/core-dev` → `tsconfig/node.json` → `@tsconfig/node24`) resolvia, menos los tipos globales del
bundler (`PRODUCCION`, `ENTORNO`, `NEXTJS`, …), que este codigo no usa — comprobado antes de
quitarlos. El riesgo es quedarse atras si el tsconfig base cambia; lo compensa que estos cinco
ficheros se compilan tambien **dentro** de las dos CLI, que si lo extienden, asi que una
divergencia que importara saldria alli.

### `arranque.js` — el unico fichero que no es TypeScript

Lo carga el `bin/*.js` de cada CLI **antes de que exista nada compilado**: intenta
`require("<bin>/min/<modulo>-run")` y, si falla, lanza `yarn run compile` y reintenta. Es el unico
arranque posible en un clon limpio —`mrpack` no puede compilarse a si mismo antes de existir—, y
por eso tiene que ser JS plano y CommonJS.

Estaba duplicado, una copia en el `bin/` de cada CLI, desde que se separaron. Se unifico aqui el
2026-09-04.

Tres detalles que no se ven leyendolo por encima:

- **Recibe el `__dirname` de quien llama** (`bin`). Dentro de este modulo, `__dirname` es el de
  `@mr/core-cli`, asi que sin el parametro el `chdir` y el `require` del bundle apuntarian aqui.
- **La supresion de `DEP0040` no es cosmetica en `mrpack`**: `dd-trace` y `@google-cloud/storage`
  llegan a `punycode` por `node-fetch@2` en runtime. Comprobado quitandola: `mrpack` emite el aviso
  y `mrlang` no —no tiene esas dependencias—, pero se deja para los dos porque es inocua.
- **Compila cuando el bundle falta, no cuando esta viejo.** Lo segundo lo detecta `mrpack`
  comparando el `bin/hash.md5` de cada CLI.

### `esbuild.mjs` — la compilacion, compartida

`compilar({url, entry, watch, alWatch})` hace lo que hacian los dos `src/esbuild.config.mjs`, que
eran el mismo fichero con distinto entry. Cada CLI se queda con un config de diez lineas; el de
`@mr/cli` tiene ademas el enganche que arranca el watch de `mrlang`, que le pasa por `alWatch`.

De la `url` que recibe —el `import.meta.url` del que llama— sale todo lo que es de cada CLI: su
directorio, su `package.json` (de donde salen los externals), su `tsconfig` y la resolucion de
`typescript`. **Por eso `typescript` no es dependencia de este paquete**: se resuelve desde el
llamante, que ya lo declara. `esbuild` si lo es, porque lo importa este modulo.

Comprobado al extraerlo: los dos bundles salen **byte a byte identicos** a los de antes.

### `fs.ts` y `log.ts` — forks, no copias

Los dos son forks parciales de `services-comun/modules/utiles/`, y la razon esta escrita en su
cabecera: el `log` original depende de `dd-trace` y gestiona los modos `KUBERNETES`/`DATADOG`, y
el `fs` original lo arrastra por importar de el. Las CLI corren siempre en local o CI, asi que esa
logica no aporta nada y solo engorda el bundle.

Consecuencia de mantenimiento: si hace falta una funcion que el fork no trae, **se porta aqui**;
cambiar el import al original de `services-comun` reintroduce `dd-trace` en el bundle sin que nada
lo delate.

De aquellos originales, `fs.ts` tomaba ademas `md5` y `random`; las dos son ya locales (ver arriba).

### `colors/` — dos capas

`base.ts` son los codigos ANSI (`FgCyan`, `Bright`, …) y el helper `colorize`. `index.ts` extiende
esa clase con un ciclo de 21 combinaciones color/intensidad, que es lo que permite dar a cada
workspace un color estable y distinto en la consola de `mrpack devel`.

La base la usan `index.ts` y un unico consumidor de fuera, `mrpack/utiles/tty.ts`, que solo quiere
los codigos. Se mantienen separadas porque son dos cosas distintas —una tabla de codigos y una
politica de asignacion— y porque asi el consumidor normal importa `@mr/core-cli/colors` sin saber
que hay una capa debajo.

> Ojo: `services-comun/modules/utiles/colors` es **otro** modulo distinto, y tambien se usa desde
> las CLI. El de aqui es el que tiene el ciclo.

### `modulo.ts` — la clase base de un comando

`Modulo<T>` parsea `process.argv` con `node:util/parseArgs` segun la config que declare la
subclase, y delega en dos hooks: `parsePositionals` (opcional, no-op por defecto) y `parseParams`
(abstracto). `Modulo.run()` arranca el comando dentro de un `PromiseDelayed()` y se traga el
rechazo `undefined`, que es como los comandos senalan «ya he escrito yo el error».

`this.root` sale de `process.env.MRPACK_ROOT`, con `process.cwd()` de reserva. Lo fija el `bin` de
cada CLI desde su propio `__dirname` — **cada uno cuenta una profundidad distinta**, porque
`@mr/cli` cuelga de dos niveles y `@mr/core/i18n` de tres.

Las dos CLI extienden esta clase antes de usarla: `mrpack` directamente, y `mrlang` a traves de su
propio `Modulo` (`@mr/core-i18n/src/modulo.ts`), que le anade el cierre de la conexion MySQL.

## Dependencias

- `dependencies`: `tslib`
- `devDependencies`: `@types/node`, `esbuild`

`esbuild` entro con `esbuild.mjs`. Es la unica excepcion a la regla de mantener este paquete sin
dependencias, y esta razonada: el oficio del paquete es sostener las dos CLI, y compilarlas es
parte de eso. `typescript` **no** entro, porque se resuelve desde el paquete que llama.

Ver [«Sin dependencias, a proposito»](#sin-dependencias-a-proposito) para lo demas.

## Consumidores

| Quien | Que usa |
|-------|---------|
| `@mr/cli` (`mrpack`) | `arranque` desde `bin/mrpack.js`, y los cinco modulos en 45 ficheros: `colors` (30), `fs` (26), `modulo` (8), `log` (1) y `colors/base` (1) |
| `@mr/core-i18n` (`mrlang`) | `arranque` desde `bin/mrlang.js`, y cuatro modulos en 21 ficheros: `fs` (14), `colors` (9), `modulo` (7) y `log` (1). No usa `colors/base` |

**Ninguno de los dos depende del otro**, que es exactamente lo que este paquete existe para
sostener. Si alguna vez aparece un import de `@mr/cli` en `@mr/core-i18n` o al reves, es que algo
que deberia estar aqui se quedo alli.

## Mantenimiento

- Un modulo nuevo no es visible hasta que se anade su clave a `exports`.
- Antes de anadir algo aqui, la pregunta es si lo necesitan **las dos** CLI. Si solo lo necesita
  una, su sitio es esa CLI.
- Los forks (`fs`, `log`) no se sincronizan solos con `services-comun`. Si el original gana una
  funcion util, se porta a mano y se anota en el CHANGELOG.
