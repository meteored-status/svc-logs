# [Changelog](https://keepachangelog.com/en/1.1.0/) — `@mr/core-i18n`

---

## 2026.9.4 19:40 — [Jose]

### Removed

- **Fuera la dependencia a `@mr/core-dev`.** No había ni un import: solo aportaba el `tsconfig`
  base y unos tipos globales del bundler (`PRODUCCION`, `ENTORNO`, …) que este paquete no usa,
  comprobado antes de quitarlos.

  `tsconfig.json` extiende ahora **`@tsconfig/node24` directamente** —lo que había al final de
  aquella cadena— y solo declara encima lo que el monorepo cambia. La configuración resuelta es
  **idéntica opción por opción** a la anterior; lo verifiqué con `tsc --showConfig` antes y después.
  Se cambia una devDep de workspace por una de npm de tres líneas.

  Quedan `@mr/core-cli`, `@tsconfig/node24`, `@types/node`, `@types/source-map-support`, `esbuild`
  y `typescript`.

### Fixed

- `src/tsconfig.json` seguía extendiendo el de `@mr/core-dev`, y al quitar la dependencia el
  `extends` dejaba de resolver **en silencio**: sin opciones, el typecheck del CLI se llenaba de
  errores de tipos de `chokidar`. Ahora extiende el del propio paquete. Lo cazó el typecheck, no
  el build — esbuild compilaba igual.

> El precio de esto conviene tenerlo presente: el `tsconfig` deja de heredar los cambios del base
> del monorepo, y aquí pesa más que en otros paquetes porque **se exporta** y lo extiende el
> workspace `i18n/` de cada proyecto. Lo que sí siguen heredando es la base de Node 24.

---

## 2026.9.4 18:15 — [Jose]

### Changed

- **`src/esbuild.config.mjs` se queda en diez líneas.** La compilación pasa a
  `@mr/core-cli/esbuild`, compartida con `mrpack`. Bundle byte a byte idéntico.

- **`bin/lib.js` desaparece**: el arranque pasa a `@mr/core-cli/arranque`, compartido con `mrpack`.
  Era una copia del de `@mr/cli`, hecha al separar las dos CLI.

### Fixed

- **`mrlang` se quedaba ejecutando el bundle viejo tras actualizar el paquete.** `bin/lib.js` solo
  compila cuando el bundle **falta**, no cuando está desfasado, así que el `bin/min/` anterior
  seguía en su sitio y nada lo delataba. **Es una regresión de la separación de las dos CLI**:
  mientras `mrlang` vivía en `@mr/cli`, se rehacía con `mrpack` en la misma pasada de
  `recompilarCliente()`.

  Ahora hay `bin/hash.md5`, el mismo mecanismo que ya usaba `mrpack`: guarda el md5 de `bin/min/`
  de la última compilación, y `mrpack` lo comprueba al arrancar —`devel`, `update` e `init`— y al
  terminar una tanda del gestor de frameworks. Si no cuadra, recompila en producción y lo vuelve a
  anotar. Sin reinicio, que es la diferencia con el cliente: `mrpack` no está ejecutando este
  código.

### Added

- `bin/.mr-ignore` (`min`) y `bin/.mr-nohash` (`hash.md5`). **El bundle no se envía con el
  framework** —cada repo compila el suyo—, y lo que viaja son los 32 bytes del hash, que es justo
  lo que dispara la recompilación: el del que envió no cuadra con el bundle local. Va en
  `.mr-nohash` para que recompilar en local no haga que el paquete parezca modificado.

Comprobado en los tres escenarios: con un `hash.md5` ajeno recompila y lo corrige; en un clon
limpio —sin bundle ni hash— compila y siembra el fichero; y en reposo no hace nada.

> Al implementarlo entendí mal el mecanismo y lo dejo escrito por si a alguien le pasa: **el hash
> compara el bundle, no el fuente**. Cambiar un `.ts` sin recompilar no dispara nada, y es
> correcto que no lo haga — eso es trabajo del watch. Lo que detecta es que el `bin/min/` que hay
> no es el que produjo la última compilación anotada.

---

## 2026.9.4 16:45 — [Jose]

### Added

- **`exports` publica `./tsconfig.json`**, para que el workspace `i18n/` de cada proyecto pueda
  extenderlo. La clave lleva extensión porque es literalmente lo que se escribe en un `extends`,
  mismo criterio que en `@mr/core-dev`.

### Changed

- **`mrlang init` deja de declarar `services-comun` en los proyectos que generan con v2**, y les
  apunta el `tsconfig.json` a `@mr/core-i18n/tsconfig.json` en vez de a
  `services-comun/tsconfig.json`. Las dos cosas van juntas: el `extends` viejo es lo que obligaba a
  declarar el paquete, así que quitar uno sin el otro deja el tsconfig sin resolver. El destino no
  añade ninguna dependencia nueva, porque el workspace ya necesita `@mr/core-i18n` por el runtime.

  En **v1 no cambia nada**: el código que genera importa `services-comun/modules/traduccion/*`, así
  que ahí la dependencia sigue haciendo falta.

- **Cómo se decide la versión, que antes era frágil.** Salía de comparar el script `generate` con
  una cadena exacta, así que un espacio de más o cualquier cosa detrás bastaba para que el proyecto
  pasara por v1 — y se le reescribiera el `generate` quitándole el `-v2`. Ahora lo detecta
  `esV2()`, que acepta las cuatro formas del flag (`-v2`, `-v 2`, `--version=2`, `--version 2`).
  Comprobado sobre los nueve casos, incluidos los negativos y el script ausente.

- **`WS002` migra los proyectos que ya existen**: además de declarar `@mr/core-i18n`, en los de v2
  quita `services-comun` y reescribe el `extends`. Solo en v2, y solo si el `extends` es
  exactamente el de `services-comun`. Comprobado sobre este repo: dos cambios y, en la segunda
  pasada, ninguno.

---

## 2026.9.4 16:10 — [Jose]

### Removed

- **Fuera la dependencia a `services-comun`.** Quedaban **cuatro imports reales**, todos en el
  generador v1 (`src/clases/`); ni `modules/` —los idiomas y el runtime v2— ni `spec/` ni
  `clases-v2/` tocaban nada:

  | Venía de | Qué era | Dónde está |
  |----------|---------|------------|
  | `utiles/colors` | `Colors`, en 2 ficheros | `@mr/core-cli/colors`, que ya usaban otros cuatro ficheros del mismo CLI |
  | `utiles/fecha` | `Fecha.generarVersion()`, 1 llamada | `generarVersion()`, privada en `clases/modulo/json.ts` |
  | `traduccion/set` | el tipo `TValor` | `clases/modulo/traduccion/set/index.ts` |

  El bundle del CLI baja de **62,0 kB a 57,9 kB**.

### Notas

- **El grep engañaba.** Parecían diez usos del runtime v1 de traducciones; nueve están dentro de
  template literals, o sea los imports que el generador v1 *escribe* en el código que produce, no
  los suyos. El único de verdad era `TValor`, y como tipo.
- `generarVersion()` se comprobó contra el original sobre **200.005 fechas** —los casos de borde a
  mano y el resto aleatorias en un rango de 60 años—: cero diferencias. Importa porque de ahí sale
  la versión que se escribe en los módulos generados.
- `TValor` es `string|null`, y el tipo es estructural: el código v1 que genera ese mismo fichero
  sigue importando el de `services-comun` y encaja igual.
- El código generado por **v2** ya no menciona `services-comun` en ningún punto. El de **v1** sí
  —importa su runtime de traducciones—, y por eso `mrlang init` sigue declarando `services-comun`
  en el `i18n/package.json` de los proyectos.

---

## 2026.9.4 15:20 — [Jose]

### Added

- **El runtime de traducciones v2 se muda aquí** desde
  `services-comun/modules/traduccion/v2/`. Doce ficheros a `modules/`: `Literal`,
  `TranslationMap`, `TranslationSet`, los `Value` —singular y plural—, `getLang()` y el builder de
  reglas CLDR.

  El sitio es este porque **el generador que hay al lado es quien escribe los imports a este
  runtime**. Estando separados, un cambio en el formato generado se repartía entre dos paquetes de
  framework con envíos independientes; ahora se hace en uno.

- **El mapa `exports` publica nueve rutas y ni una más.** Tres ficheros se quedan dentro a
  propósito: `modules/index.ts` (la base abstracta `Translation`), `modules/value/value.ts`
  (`Value` y `TParams`) y `modules/example.ts` —una demo que hace `console.log` al importarse—.
  Comprobado antes de decidirlo: de las ocho rutas que emite el generador y del único import a
  mano del monorepo, ninguna pide esos tres.

- **Las pruebas del runtime se vienen con él**: cinco ficheros y 34 casos, de
  `services-comun/spec/traduccion/v2/`. El workspace estrena por eso `tsconfig.spec.json` y script
  `test`, el mismo arnés de `node:test` + `tsc` de `services-comun`, sin dependencias nuevas.

### Changed

- `src/clases-v2/modulo/` emite ya `@mr/core-i18n/*` en el código que genera: 11 rutas en cinco
  ficheros del generador. Regenerado y comprobado que los 4.678 ficheros de `i18n/.src` salen con
  las rutas nuevas y ninguna vieja.
- **`TParams` deja de venir de v1.** `modules/index.ts` y `modules/literal.ts` lo importaban de
  `services-comun/modules/traduccion` —el generador **anterior**— teniendo uno idéntico en
  `value/value.ts`. Era una atadura sin motivo cuando estaban en el mismo paquete; al mudarse
  habría sido una dependencia entre paquetes. Ahora usan el de casa.
- `mrlang init` escribe `@mr/core-i18n` en las `devDependencies` del `i18n/package.json` que crea.

### Migración

Dos reglas nuevas en el sistema de patches de `@mr/core-dev`:

- **`R035`** reescribe `services-comun/modules/traduccion/v2/*` → `@mr/core-i18n/*`. Una sola regla
  cubre las ocho rutas porque el traslado conserva la estructura bajo el prefijo. La barra final
  del patrón es deliberada: sin ella capturaría también el `index.ts`, que no se exporta.
- **`WS002`** declara `@mr/core-i18n` en el `i18n/package.json`. Hace falta porque WS001 no puede:
  deduce las dependencias de los imports **escritos en disco**, y las reglas de fichero saltan
  `i18n/` a propósito por ser un árbol generado. Sin esta regla, tras actualizar el framework el
  proyecto no declara el paquete hasta un segundo `patch:apply` posterior a la primera
  regeneración, y entre medias la compilación falla con `Cannot find module
  "@mr/core-i18n/literal"`. **No es teórico: pasó al hacer esta migración**, y lo cazó el
  typecheck de `status-frontend` y `status-control`.

Las dos comprobadas sobre un canario: R035 reescribe los seis imports y deja intactos el
comentario y la cadena que mencionan la ruta vieja; WS002 añade la dependencia con `.src` borrado,
que es el escenario real tras un `mrpack update`.

---

## 2026.9.4 13:05 — [Jose]

### Removed

- **Las configuraciones de ejecución `pull` y `push`**, que quedaron apuntando a scripts que ya no
  existen. Se borran de `i18n/.run/` y, lo que importa más, `mrlang init` deja de crearlas: si no,
  las repone en la siguiente pasada. Queda solo `generate.run.xml`.
- **`mrlang init` deja de crear `i18n/.credenciales/`.** Ahí vivía el `mysql.json` del generador v1.

  Lo que **no** se toca, y es deliberado: `.credenciales` sigue en la lista blanca de
  `clases/generate.ts` y en la plantilla de `.gitignore` de `mrpack`. La primera es una lista de
  lo que **no** se borra, así que quitarla convertiría un `mrlang generate` en un borrado de
  credenciales reales en cualquier repo que todavía las tenga; la segunda es lo que evita que esas
  credenciales acaben comiteadas. El directorio deja de crearse, pero el que exista se respeta.

- **Fuera todo MySQL.** Era del generador v1, que además de en JSON persistía las traducciones en
  una base de datos, y ya no se usaba. `mrlang` pasa de cinco comandos a **dos**: `generate` e
  `init`.

  Se van diez ficheros: los comandos `pull`, `push` y `fremote` (`modulos/` y `clases/`),
  `clases/modulo/mysql.ts`, `clases/modulo/traduccion/loader/mysql.ts`, `mysql.ts` y `modulo.ts`
  —este último existía **solo** para cerrar la conexión al terminar, así que `MRLang`,
  `ModuloGenerate` y `ModuloInit` extienden ya directamente `@mr/core-cli/modulo`—.

- **Tres dependencias npm menos**: `mysql2`, `dd-trace` y `@ungap/structured-clone`, que entraban
  por `services-comun/modules/database/mysql`. Quedan `chokidar`, `source-map-support` y `tslib`.
  El bundle pasa de **86,3 kB a 62,3 kB**.

- Con ellos se va lo que solo leía el push, y que se quedaba de solo escritura: `Modulo.cambio`,
  `IModuloConfig.nuevo` —el único campo de esa interfaz—, `ModuloJSON`'s `borrar`,
  `Traduccion.nuevo`, `IdiomasLoader.fromMySQL()` y los métodos `preparePush`/`toMySQL`/`borrar`/
  `quitarSubmodulo`/`guardar`/`fixVersion`. Detectado con
  `tsc --noUnusedLocals --noUnusedParameters` y a mano para los campos de clase, que el compilador
  no marca.

  Un efecto de esto se ve en `ModuloJSON.load()`: las dos ramas del `if` construían configs
  distintas —`borrar: true` cuando no había `_metadata.json`— y ahora son idénticas, así que se
  funden. Ese flag marcaba el módulo como borrado en la base de datos; sin base de datos no hay
  nada que borrar.

- `mrlang init` deja de escribir los scripts `pull`/`push` en el `i18n/package.json` de los
  proyectos, y el de este repo se queda solo con `generate`.

### Notas

- **Las dos generaciones del generador son ya solo-JSON**, que era lo que de verdad las separaba.
  Lo que las sigue distinguiendo es el formato del `.json` y el runtime que consumen.
- La migración pendiente de v1 a v2 es ahora más corta: solo queda `init`.
- Comprobado que no cambia nada de lo que sí se usa: los **4.678** ficheros de `i18n/.src` salen
  byte a byte idénticos tras regenerar, `tsc` limpio, y `mrlang --help` ya no ofrece los tres
  comandos retirados.

---

## 2026.9.4 11:40 — [Jose]

### Added

- **`mrlang` se muda aquí desde `@mr/cli`**, con su `bin` propio. El workspace pasa a alojar dos
  cosas: la librería de tipos en `modules/` y el CLI de traducciones en `src/` + `bin/`. Se tocan
  en un solo punto —`src/clases/init.ts` lee `soportados` como lista por defecto—, y ese import
  pasa de `@mr/core-i18n/langs` a la ruta relativa `../../modules/langs`, que es lo que toca
  estando ya dentro del paquete.

  Las tres formas de invocarlo siguen funcionando y dan lo mismo: el bin de la raíz
  (`yarn mrlang`), el script del workspace (`yarn workspace @mr/core-i18n mrlang`) y el atajo del
  workspace de traducciones (`yarn run i18n run generate`).

- `bin/mrlang.js`, `bin/lib.js` y `src/esbuild.config.mjs`, calcados de los de `@mr/cli` pero con
  un solo módulo. `bin/min/` queda gitignored.

### Changed

- **Lo que `mrlang` compartía con `mrpack` sale a [`@mr/core-cli`](../cli/README.md)** —`fs`,
  `log`, `colors` y la clase base `Modulo`—, del que dependen las dos CLI. Ninguna de las dos
  depende ya de la otra, que era el objetivo de la separación. `@mr/cli` pierde de paso su devDep
  a `@mr/core-i18n`, que existía solo por este CLI.
- El `package.json` gana `bin`, los scripts `mrlang`/`compile`/`compile:watch` y las dependencias
  del CLI. **Son del CLI, no de la librería**: quien importa `@mr/core-i18n/langs` no las arrastra,
  porque `exports` solo publica esa ruta y porque este paquete es devDependency en todos sus
  consumidores.

### Fixed

Dos cosas que la mudanza rompía y que ni `tsc` ni el bundler detectan, porque son rutas en
cadenas de texto. Salieron al regenerar de verdad y comparar la salida:

- **El catálogo de idiomas se leía por una ruta escrita a mano**,
  `@mr/cli/src/mrlang/clases-v2/lang/assets/langs.json`, que tras el traslado ya no existía:
  `mrlang generate` moría con `ENOENT` y dejaba `i18n/.src` **vacío**. Ahora apunta a
  `@mr/core/i18n/src/clases-v2/lang/assets/langs.json`.
- **`mrlang init` escribía en los proyectos scripts que apuntaban a `@mr/cli`**
  (`yarn workspace @mr/cli mrlang generate -v2`). Habría revertido los scripts en el siguiente
  `init`.
- **El `chdir` de `src/main.ts` contaba dos niveles** (`../..`), que era correcto colgando de
  `@mr/cli` y aquí apuntaba a `@mr/`. Pasa a usar `MRPACK_ROOT`, que fija el bin desde su propio
  `__dirname`, de forma que la profundidad del workspace se sabe en un solo sitio.

Comprobado regenerando `i18n/.src` por las tres vías de invocación, y una de ellas desde un cwd
distinto de la raíz, que es donde un `chdir` mal calculado se nota: los **4.678 ficheros** salen
byte a byte idénticos a los de antes de mover nada.

---

## 2026.9.4 09:12 — [Jose]

### Changed

- **El fuente se muda a `modules/langs.ts`**, y la ruta pública **no cambia**: sigue siendo
  `@mr/core-i18n/langs`. Lo sostiene el mapa `exports` del `package.json`
  (`"./langs": "./modules/langs.ts"`), que es el patrón que ya usan `@mr/core-utils` y
  `@mr/core-dev` — clave sin extensión, destino con ella. Ninguno de los siete consumidores
  necesita tocar su import.

  Comprobado en los dos planos, no solo en el de tipos: `require.resolve("@mr/core-i18n/langs")`
  desde un workspace que declara la dependencia devuelve `@mr/core/i18n/modules/langs.ts`, y
  `tsc --noEmit` pasa en los tres paquetes que lo importan (`@mr/core-network`, `@mr/cli` y
  `services-comun`).

### Fixed

- **Los conteos de la documentación estaban mal desde el primer día**, los tres documentos a la
  vez: decían «24 largos» y «64 totales» cuando son **26 y 66**. No era documentación
  caducada —el único commit que ha tocado el fichero ya traía 26—, era un error de cuenta: el
  listado del README sí estaba completo, fallaba solo el número que lo resumía. Corregido
  también en la entrada histórica de más abajo, porque un número que nunca fue cierto no es
  historia que preservar. El CODEMAP lleva ahora la orden para recontar sin hacerlo a ojo.

### Added

- **Documentada la trampa de `corto("fil")`**, que devuelve `"fi"`: `"fil"` (filipino) es el
  único código corto de tres letras de la lista, y `slice(0, 2)` lo convierte en finés — un
  idioma **que también está soportado**, así que no lanza, no devuelve `undefined` y el tipo
  declarado se cumple. Comprobado ejecutándolo. No hay incidencia porque `corto()` no tiene hoy
  ni un llamante en el monorepo; queda escrito para que quien vaya a servir filipino lo arregle
  antes de usarla.
- **Documentado quién consume qué**, que resultó ser bastante menos de lo que sugiere la lista
  de exports: los tipos los usan `@mr/core-network` y `services-comun`, `soportados` solo lo usa
  `@mr/cli` en `mrlang init`, y **`soportado()` y `corto()` no los llama nadie**.
- Avisos que faltaban y se comprobaron al escribirlos: que `soportado()` **no es guarda de
  tipo** y pide un cast para lo que llega de fuera; que `soportados` y las dos uniones se
  mantienen a mano y **el compilador no comprueba que cuadren** (hoy cuadran); y que
  `corto()` **no es** `parseIdioma()` de `services-comun`, que solo recorta sufijos numéricos y
  deja `"es-ES"` intacto.

---

## 0.0.0+1 — [@bixus](https://github.com/bixus)

### Added

- **`langs.ts` — tipos y utilidades de idiomas** — primer fichero del paquete.
  Exporta la definición canónica de todos los idiomas soportados por el sistema:

  - **`IdiomaCorto`** — unión de 40 códigos ISO 639-1
    (`"ar"`, `"bn"`, `"ca"`, … `"vi"`).
  - **`IdiomaLargo`** — unión de 26 variantes regionales BCP 47
    (`"es-ES"`, `"pt-BR"`, `"en-US"`, …).
  - **`Idioma`** — unión de `IdiomaCorto` e `IdiomaLargo`; tipo principal para
    cualquier código de idioma válido en el sistema.
  - **`soportados: Idioma[]`** — array con los 66 idiomas activos (40 cortos + 26 largos).
  - **`soportado(lang): boolean`** — comprueba si un código de idioma pertenece
    a la lista de soportados.
  - **`corto(idioma): IdiomaCorto`** — extrae el código corto ISO 639-1 de un
    idioma largo o corto (primeros dos caracteres).

- **`README.md`** — documentación del paquete con descripción de tipos, constantes
  y ejemplos de uso.

