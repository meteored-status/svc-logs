# [Changelog](https://keepachangelog.com/en/1.1.0/) — `@mr/core-i18n`

---

## 2026.9.29 12:59 — [Juan Carlos]

### Fixed

- **`langChain()` vuelve a compilar para navegador.** Usaba `Array.prototype.at()`, que es ES2022, y el
  `tsconfig/browser.json` de `@mr/core-dev` se queda en ES2015: los bundles de navegador que importan
  `modules/util/lang.ts` fallaban con `TS2550`. Además del error de tipos, `.at()` no existe en navegadores
  anteriores a ES2022 (Safari/iOS < 15.4), y `getLang()` corre en el navegador para elegir idioma. Se accede
  al último subtag con `subtags[subtags.length - 1]`, sin cambiar el comportamiento.

## 2026.9.28 14:27 — [Jose]

### Changed

- **`bin/.mr-ignore` excluye también `bin/versiones`**, el sello local con el que `mrpack` decide ahora si
  hay que recompilar `mrlang` tras actualizar el framework (ver `@mr/cli`, `checkMrlang()`). Ya no hace
  falta el `yarn workspace @mr/core-i18n run compile` a mano después de recibir un cambio del generador.
  README, «El bundle se rehace solo cuando toca», actualizado.

## 2026.9.28 14:15 — [Jose]

### Fixed

- **El aviso de idiomas que faltan ya no salta por lo que se hereda de la misma lengua.** Un `es-MX` sin valor
  propio en una entrada que sí tiene `es` avisaba de que «cae al defecto y la pantalla sale medio traducida»,
  cuando el generador (`resolverValor()`) le da el valor de `es`. `avisosDeIdioma()` miraba solo las claves
  escritas en la entrada. Ahora recorre la misma cadena del catálogo que el generador, **pero solo mientras
  siga en la misma lengua**: `es-MX` → `es` y `en-CA` → `en` no avisan, y `es-MX` → `es` → `en` o `ca` →
  `es-ES` siguen avisando, porque lo que sale en pantalla es otra lengua. Pruebas en `spec/idiomas.spec.ts`.

## 2026.9.25 11:45 — [Juan Carlos]

### Changed

- **`mrlang generate -v2` escribe un `index.ts` por idioma×módulo con todas las entradas dentro**, en vez de
  un `.ts` por clave más un `index.ts` que los importaba. Los emisores (`literal.ts`, `map.ts`, `set.ts`)
  devuelven ahora una `IEntradaEmitida` (`imports`, `lineas`, `expresion`) en vez del fichero, y
  `ModuloJSON.generateLangIndex(entradas)` las mete cada una en su propia IIFE.

  El motivo es el build: la división por clave no le daba nada al cliente —el `index.ts` las importaba
  estáticamente y acababan en el mismo chunk—, pero multiplicaba ~20× los módulos que ve webpack. En
  `meteored-svc-panel-frontend` eran ~49.800 ficheros y el `next build --webpack` de `panel-frontend-business`
  tardaba **14 min**, 9 de ellos en `optimize-chunk-modules`. Ahora son 2.277 ficheros y tarda **65 s**.

  **La carga asíncrona por idioma no cambia**: el `import()` dinámico de `definitions/` sigue apuntando al
  mismo directorio, siguen saliendo los mismos chunks por idioma×módulo (2.090 en business) y el mismo peso
  de `.next/static`.

  **Después de actualizar, recompilar `mrlang` a mano: `yarn workspace @mr/core-i18n run compile`.** Este
  envío no toca `bin/`, y `mrpack` solo recompila cuando el `bin/hash.md5` local no cuadra con el
  `bin/min/` local (ver README, «El bundle se rehace solo cuando toca»): un repo que ya lo tenía compilado
  seguiría generando con el `mrlang` anterior. Cloud Build no lo sufre, compila de cero.

  **La primera regeneración con esta versión borra los ~47.500 ficheros por clave del esquema anterior**,
  vía `limpiarHuerfanos()` — no hace falta código aparte, ya que esos ficheros dejan de estar entre lo que
  `generateModule()` devuelve como escrito. Es lo esperado: se ve como un `git status` enorme en `.src`
  (gitignored) la primera vez que alguien regenera tras actualizar el framework.

- **Una entrada sin valor para un idioma rechaza la generación**, con módulo, entrada e idioma. Antes se
  saltaba su fichero pero el `index.ts` lo importaba igual, y el fallo aparecía después en el build como un
  «Cannot find module». En este proyecto no hay ningún caso.

  La comprobación se hace ahora **antes de escribir nada**, junto a `validar()` (`Generate.problemasDeValor()`,
  nuevo): antes vivía a mitad de `generateModule()`, y un módulo con una sola entrada así dejaba escritos
  varios `index.ts` de idiomas anteriores a esa entrada antes de rechazar —alguno importando un `XParams`
  que `definitions/` de ese módulo todavía no exportaba—. El chequeo de dentro de `generateModule()` se
  queda, como defensa.

- **`ModuloJSON.validar()` rechaza `id`s que romperían el `index.ts` generado**: una palabra reservada de
  JavaScript (`public`, `static`, `let`…), un `id` —o el nombre del módulo en PascalCase— que coincide con
  un nombre que la cabecera o los emisores ya declaran en la raíz del fichero (`Module`, `Literal`,
  `SingularValue`, `PluralValue`, `TPluralKey`, `pluralBuilder`, `TranslationMap`, `TranslationSet`), y dos
  entradas que generan el mismo nombre de tipo (`XParams` o `XKeys`). Este último caso antes daba `TS2300`
  al compilar dos imports iguales en la misma cabecera; con la cabecera reducida a solo `Module` (ver el
  primer punto), el `Set` de imports de `generateLangIndex()` los dedupica en silencio, así que sin esta
  regla el choque no se ve nunca — una entrada acaba usando los `params` de la otra sin que nada avise.
  Se agrupa por el nombre del tipo y no por `pascalCase(id)`: un `map` sin params (`FooBarKeys`) y un
  literal con params (`FooBarParams`) comparten PascalCase, no chocan y se siguen aceptando.

  De todo esto, lo único que **antes compilaba y ahora se rechaza** es un módulo cuyo nombre en PascalCase
  coincide con un símbolo del runtime (`literal.json`, `translation-map.json`…): con el esquema de un
  fichero por clave el `index.ts` no importaba esos símbolos. El resto —palabras reservadas, `id`s que no
  son identificadores, `id` igual al nombre del módulo— ya rompía el `import <id> from "./<id>"` antiguo.

  También rechaza un `id` que **no sea un identificador de JavaScript** (empieza por dígito, lleva guion,
  punto…), con la gramática de ECMAScript (clases Unicode `ID_Start`/`ID_Continue`) y no con un regex
  ASCII: tres entradas reales del proyecto —`cerrar_sesión`, `un_día_prueba`, `un_envío`— llevan tilde, son
  identificadores válidos, y `[A-Za-z_$][\w$]*` habría roto la generación de dos módulos sin nada mal escrito.

### Fixed

- **El watch (`--watch`) mataba el proceso entero con un `.json` que se quedara sin valor para algún
  idioma**: desde que `generateModule()` rechaza por eso, el handler de `chokidar.on("change", ...)`
  propagaba ese rechazo como un `unhandledRejection` sin nadie que lo esperase, y Node termina el proceso.
  Ahora todo el cuerpo del handler va en `try/catch` y lo que antes mataba el watch se registra con
  `error()` y sigue vivo. También valida (`validar()` + `problemasDeValor()`) **antes** de tocar el disco,
  igual que `run()`: si el `.json` que se acaba de guardar tiene un problema, no escribe nada encima de lo
  que ya había.

- **El watch se llevaba por delante los módulos hermanos de todos los idiomas** (preexistente, no de esta
  tarea, pero se corrige de paso porque el mismo bloque lo toca): el `unlink()` de después de cada cambio
  apuntaba a `${langsDir}/${idioma}${modulo.path()}`, que es el directorio del **grupo** (p. ej. `/pages`),
  no el del módulo, y `unlink()` borra directorios en recursivo. Cualquier `.json` que cambiara se llevaba
  **todos** los módulos hermanos de **todos** los idiomas, y `generateModule()` solo regeneraba el que
  había cambiado. Se quita esa línea: `generateModule()` ya sobrescribe todo lo suyo (un `index.ts` por
  idioma×módulo, no hace falta borrar antes), y lo único que puede quedar huérfano —un idioma que el
  módulo ha dejado de declarar— se poda aparte, después de generar, y solo sobre el directorio propio de
  ese módulo (`${langsDir}/${idioma}${modulo.path()}/${modulo.name()}`).

### Comprobado

- Equivalencia en runtime: compilados con esbuild el `.src` anterior y el nuevo, las 47.450 entradas de los
  2.277 índices dan el mismo valor con los contadores 0, 1, 2, 3, 5, 11, 21 y 1.000.000. Cero diferencias.
- `tsc --noEmit` sobre todo `i18n/.src/{langs,definitions}` con el tsconfig de `panel-frontend-business`:
  sin errores. `yarn workspace @mr/core-i18n typecheck`, `compile` y `test` (68/68, las 9 nuevas en
  `spec/generate-lang-index.spec.ts`) en verde. `yarn workspace i18n run generate` sigue en 2.277 ficheros.
- `set` no lo usa hoy ningún `.json` del proyecto; se probó con un módulo temporal (dos singulares y un
  plural) y se borró después.
- Las nuevas validaciones de `id`, comprobadas contra los `.json` reales del proyecto antes de añadirlas:
  cero colisiones con los nombres fijos, cero `pascalCase(id)` compartidos dentro de un módulo y cero `id`s
  que no sean identificadores (las tres con tilde pasan, como deben).
- Revisión adversarial (2026-09-28): corregida la agrupación de choques de tipo, que rechazaba datos
  válidos (`XKeys` frente a `XParams`), y los ZWNJ/ZWJ de `IDENTIFICADOR`, que estaban como caracteres
  invisibles literales y ahora van como `\u200C\u200D`. `test` 68/68.
- Watch probado en vivo (`mrlang generate -v2 --watch`), sin dejar procesos colgados: dos módulos hermanos
  en el mismo directorio, cambio en uno con el otro intacto; una entrada sin valor deja el proceso vivo,
  solo registra el error y no escribe nada; corregido el `.json`, el módulo se regenera normal. Los
  ficheros de prueba eran temporales, fuera de `i18n/.json`: `git diff -- i18n/.json` sin cambios al
  terminar.
- **Se rompió a propósito el código que cubren tres de las pruebas nuevas, y cada vez falló solo la suya**:
  reintroducir `import x from "./x";` en un emisor tumba «sin imports a ficheros hermanos»; desactivar en
  `validar()` el chequeo de palabra reservada tumba «id que es palabra reservada», y el de identificador
  tumba «id que no es identificador de JavaScript». Las demás siguieron en verde en los tres casos.

## 2026.9.23 09:25 — [Jose]

### Changed

- **Código adaptado a `yarn lint`** (`@mr/core-lint`), sin cambios de comportamiento: `import type` en los
  imports que solo traen tipos, llaves en todos los `if`/`else`/`for`/`while`, bloques de imports en su orden
  y separados por una línea en blanco, fuera las dobles líneas en blanco, `Tipo[]` en vez de `Array<Tipo>` y
  sin `/* STATIC */` en las clases que no tienen estáticos. Casi todo con el autofix; el orden de imports,
  con un codemod que solo movía líneas enteras.

## 2026.9.17 16:40 — [Jose]

### Changed

- **El fallback de `plural-function-builder` es la cadena del idioma, no un prefijo de tres caracteres.**
  Si `Intl.PluralRules` rechaza el tag, ahora se prueba el siguiente de `langChain()` —`es_ES` → `es-ES`,
  `ca-ES-inventado` → `ca-ES` → `ca`— y solo al agotarla se cae al inglés.

  Lo que había era `lang.substring(0, 3).replaceAll("-", "")`, y **no era código muerto como dije antes**:
  con un tag normal acierta de casualidad, porque de `es-ES` salen los tres primeros caracteres menos el
  guion, o sea `es`. Lo que no es, es una subetiqueta:

  - De `es_ES` sale `es_`, que `Intl` también rechaza: acababa en reglas **inglesas**.
  - De un código aplanado como `esES` sale `esE`, que **está bien formado**. No lanza: `Intl` lo resuelve
    al **locale por defecto del entorno** y devuelve sus reglas. Comprobado — aquí sale `en-US`. No da
    error en ninguna parte y depende de la máquina que lo ejecute.

  Hoy el generador solo emite tags con guion, así que en la práctica no había nadie cayendo en esto; era
  una trampa esperando al primero que pasara un código ya aplanado.

### Added

- `spec/plural-function-builder.spec.ts`, que tampoco existía.

### Comprobado

- La prueba del guion bajo, vista fallar contra el código anterior (reglas inglesas donde tocaba `pt-PT`,
  o sea sin categoría `many`). Las otras cuatro pasan en los dos, y una lo explica: con
  `ca-ES-inventadisimo` el prefijo de tres caracteres da `ca-` → `ca`, que es la respuesta correcta por
  el camino equivocado.

---

## 2026.9.17 15:30 — [Jose]

### Fixed

- **`corto()` corta por el separador, no por los dos primeros caracteres.** `slice(0, 2)` convertía
  `"fil"` —filipino— en `"fi"`, que es finés. Lo peor no era el fallo sino que fuera indetectable:
  `"fi"` **también** está soportado, así que no lanzaba, no devolvía `undefined` y el tipo seguía
  siendo `IdiomaCorto`. Aguas abajo no había forma de notar el cambiazo.

  Ahora devuelve la subetiqueta primaria BCP 47, que es lo que la función quiso decir siempre: vale
  igual para códigos de tres letras, de escritura (`sr-Cyrl`) y de región numérica (`es-419`).

- **`@mr/core-network/server/http/i18n` tenía su propia copia del `slice(0, 2)`** y se habría quedado
  con la versión rota. Ahora llama a `corto()`, que es de donde no debió salir.

### Changed

- **`soportado()` es una guarda de tipo y acepta `string`.** `(lang: string): lang is Idioma` en vez de
  `(lang: Idioma): boolean`. Es lo que hace usable una lista blanca cerrada: se valida en el borde y a
  partir de ahí se trabaja con `Idioma` sin volver a comprobar. Recibir `Idioma` obligaba a castear antes
  de preguntar, que es justo lo que la pregunta pretendía evitar. El cambio es compatible: quien le pasara
  un `Idioma` sigue compilando.

- Documentado que la lista de idiomas es **lista blanca cerrada por decisión**, no por limitación: la
  forma que se admite es BCP 47 entero —`ca-ES-valencia` cabe—, pero solo entra lo que alguien da de alta
  en `IdiomaLargo` y en `soportados`.

### Added

- `spec/langs.spec.ts`, que no existía. Cubre `corto()` —incluida la propiedad de la que se fía todo lo
  de aguas abajo: lo que devuelve sigue siendo un idioma soportado— y `soportado()` como guarda.

### Comprobado

- La prueba del `"fil"`, vista fallar contra el código anterior. Las demás pasan en los dos, y una de
  ellas lo explica: la propiedad «lo que devuelve sigue soportado» **se cumplía también con el fallo**,
  porque `"fi"` está en la lista. Por eso hacía falta nombrar el caso concreto.
- `@mr/core-network` typechequeado entero, y comprobado antes que el `tsc` de verdad mira ese fichero
  —metiéndole un error a propósito y viéndolo saltar—.

---

## 2026.9.17 14:10 — [Jose]

### Fixed

- **El portugués de Portugal usaba las reglas de plural del inglés.** `LANG_REGEXPS` mapeaba `pt-PT` y
  `pt` al juego de reglas `pt_PT`, y eso se emite tal cual como `pluralBuilder('pt_PT')`, o sea que acaba
  en un `new Intl.PluralRules("pt_PT")`. Con guion bajo no es un tag válido: reventaba, el `catch` de
  `plural-function-builder` intentaba un `substring(0, 3)` que da `"pt_"` y tampoco vale, y el segundo
  `catch` lo dejaba en `en-US`.

  El nombre CLDR del juego de reglas **sí** lleva guion bajo, y de ahí venía la confusión; el locale que
  hay que pedirle a `Intl` lleva guion.

  Se veía **a partir del millón**: `pt-PT` tiene categoría `many` y el inglés no, así que un traductor que
  escribiera la forma `many` no la veía usada nunca. Comprobado con un módulo de prueba: un millón de
  avisos daba «1.000.000 avisos» y ahora da «1.000.000 **de** avisos», que es como se dice. Por debajo del
  millón las dos normas coinciden, que es por lo que esto ha durado tanto sin que nadie lo notara.

  `pt-BR` no cambia: ya mapeaba a `pt`, que en CLDR es el juego brasileño.

---

## 2026.9.17 13:05 — [Jose]

### Added

- **`langChain()`** en `@mr/core-i18n/util/lang`: la cadena de búsqueda de un idioma de más específico a
  menos, quitando subtags por la derecha — `ca-ES-valencia` → `ca-ES` → `ca`. Es el *Lookup* de
  RFC 4647 §3.4, y es lo que permite resolver un tag BCP 47 que nadie ha dado de alta en ninguna lista.

  El subtag de una sola letra se va junto con el que lo sigue (`de-DE-u-co` → `de-DE`): abre una extensión
  y por sí solo no nombra ningún idioma. Lo dice la RFC y sale gratis.

### Changed

- **`getLang()` prueba la cadena entera, no solo el código exacto.** Un módulo traducido al catalán ahora
  sirve al valenciano; antes, sin acierto exacto, se caía al defecto del módulo o al `enUS` de respaldo.
  Si el módulo tiene la variante, la variante gana: la cadena va de más específico a menos. El idioma por
  defecto se busca igual, y **después** de agotar la del pedido, que es el orden que manda la RFC.

- **`Lang.getByCode()` ya no sustituye por `en-US` lo que el catálogo no conoce.** Sintetiza un idioma con
  ese código y con el padre que dice el truncado de subtags, así que la jerarquía entra en el catálogo en
  cuanto alcanza un código declarado y sigue por la herencia de siempre (`ca` → `en` → `en-US`). La cadena
  termina siempre: cada salto acorta el código.

- **La búsqueda en el catálogo ignora la caja.** `ca-es` y `ca-ES` son el mismo idioma; antes, uno escrito
  con otra caja se comportaba como un código desconocido.

- `services-comun-status`: el comentario de `IDIOMAS` daba dos motivos para no admitir `ca-ES-valencia` y
  uno de ellos era este. Queda solo el de la columna `user.lang VARCHAR(10)`.

### Comprobado

- Módulo de prueba con tres entradas y una petición en `ca-ES-valencia`: la que declara el valenciano da su
  texto, la que solo está en catalán **hereda el catalán**, y la que no está ni en catalán cae al inglés por
  la cadena del catálogo. Con el código de ayer, las dos últimas daban el `defecto` de la entrada.
- Las cuatro pruebas nuevas de `getLang`, vistas fallar contra el código de la fase anterior, con las otras
  39 en verde. Una quinta —la del subtag de una letra— falló por estar mal escrita **yo**: `de-DE-u-co` sí
  es un paso válido de la RFC. Corregida la expectativa, no el código.
- Regenerado el `i18n/` real: salida **idéntica byte a byte**. Los cuatro idiomas del panel están todos en
  el catálogo, así que nada de esto les cambia el camino.
- El panel pasa el idioma ya validado contra `["es", "en", "fr", "ca"]`, así que allí `getLang()` siempre
  acierta por código exacto y la cadena no llega a usarse. El cambio se nota en quien pase un código con
  variante — otros monorepos que resuelvan desde `Accept-Language`.

---

## 2026.9.17 11:20 — [Jose]

### Fixed

- **Un idioma con tres subtags se generaba en un directorio y se buscaba en otro.** El generador
  aplanaba el código con `lang.replace("-", "")`, que en JS sustituye solo la **primera** ocurrencia,
  y el runtime con un `replace(/[-_]/g, "")` global. Con dos subtags coincidían por casualidad
  —`es-ES` → `esES` por los dos caminos— y con tres dejaban de coincidir: `ca-ES-valencia` se
  escribía en `caES-valencia` y `getLang()` lo buscaba en `caESvalencia`.

  En el loader dinámico eso no daba ningún error: no encontraba el idioma y caía al inglés, con la
  pantalla traducida menos ese módulo. En `bundle.ts` era peor y más visible — emitía
  `import caES-valencia from ...`, que ni siquiera es sintaxis válida.

- **Un valor declarado a mano para un idioma que el catálogo no conoce se perdía.**
  `resolverValor()` entra por `Lang.getByCode()`, que a un código que no está en `langs.json`
  le devuelve `en-US` sin decirlo, así que el bucle no llegaba a mirar la clave pedida. Un
  `ca-ES-valencia` escrito en el `.json`, con su texto al lado, se generaba en inglés. Ahora la
  clave literal se comprueba antes de subir por la jerarquía.

### Changed

- **El aplanado del código de idioma es una sola función**, `flattenLang()`, en
  `@mr/core-i18n/util/lang` — donde ya estaba `getLang()`, que es el otro extremo de la misma
  convención. La usan los cinco puntos del generador v2 que la tenían escrita a mano
  (`generate.ts` y los cuatro de `modulo/definition.ts`).

- **`getLang()` compara ignorando mayúsculas**, que es lo que dice BCP 47: `ca-es-VALENCIA` y
  `ca-ES-valencia` son el mismo idioma, y de un `Accept-Language` o de un `navigator.language`
  llega lo que llega. Devuelve la entrada de `availableLangs`, no lo buscado, porque lo que sale
  de ahí es un nombre de directorio y tiene que conservar su caja.

### Comprobado

- Generando un módulo de prueba con `ca-ES-valencia` y `zh-Hant-TW`: directorios `caESvalencia` y
  `zhHantTW`, `IDIOMAS` y los `import` del bundle coherentes con ellos, y cada idioma con **su**
  texto. Con el código anterior, los mismos JSON daban `caES-valencia` y un `bundle.ts` que no
  compila.
- Regenerando el `i18n/` real de este repo: salida **idéntica byte a byte**. Los códigos de dos
  subtags no cambian de nombre.
- Las pruebas nuevas, vistas fallar contra el código viejo (3 de 5 rojas, el resto de la suite en
  verde). Las dos que pasaban en ambos son las que cubren el runtime, que en esto ya era correcto.

---

## 2026.9.12 16:55 — [Jose]

### Added

- **`typecheck`** (`tsc --noEmit` sobre el `tsconfig` del paquete). Era la única de las
  comprobaciones del monorepo que aquí había que escribir a mano; `test` solo compila el proyecto de
  specs y `compile` arrastra el `tsc` de la compilación.

- Dos atajos en la raíz del monorepo: `yarn mrlang <comando>` y `yarn run mrlang:build`.
  Comprobado que los argumentos llegan por los dos saltos —`yarn mrlang generate --help` enseña la
  ayuda de `generate`, no la de primer nivel—.

### Fixed

- La ayuda de `generate` anunciaba `yarn mrlang pull`, que es un comando retirado. Copia y pega de
  cuando `pull` existía.

- **El test de las categorías de plural fijaba el orden de la lista, y empezó a fallar solo.**
  Comparaba `pluralCategories` contra `["one", "many", "other"]`, y en el V8 de Node 22 / ICU 76
  sale en orden alfabético: `["many", "one", "other"]`.

  ECMA-402 no fija ese orden, así que la comparación no probaba nada de CLDR y convertía una
  subida de Node en un test rojo. Ahora comprueba **qué** categorías hay —que está `many`, que son
  tres, y que en inglés son dos y no está—, que es lo que la prueba quería decir desde el
  principio.

- **El catálogo de idiomas ya no se lee de disco: se importa.** `Lang.loadCatalog()` hacía
  `readJSON("@mr/core/i18n/src/clases-v2/lang/assets/langs.json")`, una ruta escrita desde la raíz
  del monorepo que solo es cierta en la disposición en la que se escribió. Fuera de ella el
  `generate -v2` no llegaba ni a empezar.

  El comentario que había descartaba `__dirname` con razón —el bundle vive en `bin/min/` y el asset
  en `src/`—, pero esa era la pregunta equivocada: **un asset del propio paquete no hay que
  encontrarlo, hay que llevárselo dentro**. Con `import catalogo from "./assets/langs.json"` el
  empaquetador lo incrusta (son 10 kB) y no queda ninguna ruta que resolver en ejecución.
  Comprobado sobre el bundle recién construido: las 91 entradas dentro, cero referencias a la ruta
  vieja.

### Changed

- **`Lang` deja de ser asíncrono, que era solo por esa lectura.** `loadCatalog()` desaparece y el
  catálogo se construye una vez al cargar el módulo; `getByCode()` devuelve `Lang` en vez de
  `Promise<Lang>` y `parent` devuelve `Lang|null`. Con ellos, `Generate.resolverValor()`, que era
  su único llamante — `Lang` no está en el mapa `exports`, así que no sale del paquete.

  Se van de paso el `if (!this.CATALOG) await this.loadCatalog()` de cada llamada y los `!` de
  después: el catálogo o está o no compila.

- **`bin/mrlang.js` son dos líneas.** El cálculo de `MRPACK_ROOT` se va a `@mr/core-cli/arranque`
  (ver su CHANGELOG), que lo resuelve para las dos CLI sin contar niveles.
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

