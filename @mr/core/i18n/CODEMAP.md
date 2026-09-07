# CODEMAP - `@mr/core-i18n`

Mapa tecnico del workspace `@mr/core/i18n/`.

## Objetivo

El workspace aloja **tres cosas** del mismo dominio:

1. **Los idiomas** (`modules/langs.ts`): idioma corto y largo, la union canonica `Idioma`, la lista
   de soportados y los helpers `soportado`/`corto`.
2. **El runtime de traducciones** (el resto de `modules/`): las clases que instancia el codigo
   generado —`Literal`, `TranslationMap`, `TranslationSet`, los `Value` y los plurales—. Vivia en
   `services-comun/modules/traduccion/v2/` hasta el 2026-09-04.
3. **El generador** (`src/` + `bin/`): `mrlang`. Es lo que ejecuta una persona.

**Que 2 y 3 esten juntos es el sentido del paquete**: el generador escribe en cada fichero que
produce un import al runtime, asi que un cambio en el formato generado se hacia antes en dos
paquetes de framework con envios independientes y ahora se hace en uno.

Entre 1 y las otras dos apenas hay contacto: `src/clases/init.ts` lee `soportados` de
`modules/langs.ts` para tener una lista de idiomas por defecto, y nada mas. `exports` publica solo
lo que se importa de fuera, asi que quien viene por los tipos no se lleva el CLI.

## Arbol de modulos

```text
@mr/core/i18n/
├─ bin/                 el CLI instalado
│  ├─ mrlang.js         entrada; fija MRPACK_ROOT
│  └─ min/              bundle generado (gitignored)
├─ modules/             LOS IDIOMAS Y EL RUNTIME
│  ├─ langs.ts          tipos de idioma, `soportados`, `soportado()`, `corto()`
│  ├─ index.ts          Translation (base abstracta) — INTERNO, no exportado
│  ├─ literal.ts        Literal
│  ├─ translation-map.ts
│  ├─ translation-set.ts
│  ├─ example.ts        demo suelta — INTERNO, no exportado
│  ├─ util/
│  │  ├─ lang.ts                     getLang()
│  │  └─ plural-function-builder.ts  reglas CLDR sobre Intl.PluralRules
│  └─ value/
│     ├─ index.ts       TPluralKey
│     ├─ value.ts       Value, TParams — INTERNO, no exportado
│     ├─ singular-value.ts
│     └─ plural-value.ts
├─ spec/                pruebas del runtime (node:test + tsc)
├─ src/                 EL CLI (mapa propio en src/CODEMAP.md)
│  ├─ main.ts
│  ├─ mrlang.ts
│  ├─ clases/           generador v1 (solo JSON)
│  ├─ clases-v2/        generador v2 (solo JSON)
│  ├─ modulos/          los dos comandos: generate e init
│  ├─ esbuild.config.mjs
│  └─ tsconfig.json
├─ README.md
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json
├─ tsconfig.json
└─ tsconfig.spec.json
```

La libreria sigue siendo un solo fichero, y sigue sin depender de nada: las `dependencies` del
`package.json` (`chokidar`, `source-map-support`, `tslib`) son **del CLI**, no suyas. Que esten declaradas aqui no las mete en el grafo de quien importa `@mr/core-i18n/langs`,
entre otras cosas porque este paquete es **devDependency** en todos sus consumidores.

## Superficie publica

Diez rutas, todas declaradas en el mapa `exports` del `package.json`:

| Ruta | Fichero | Que exporta |
|------|---------|-------------|
| `@mr/core-i18n/tsconfig.json` | `tsconfig.json` | El tsconfig base, para que el workspace `i18n/` de cada proyecto lo extienda |
| `@mr/core-i18n/langs` | `modules/langs.ts` | `Idioma`, `IdiomaCorto`, `IdiomaLargo`, `soportados`, `soportado()`, `corto()` |
| `@mr/core-i18n/literal` | `modules/literal.ts` | `Literal` |
| `@mr/core-i18n/translation-map` | `modules/translation-map.ts` | `TranslationMap` |
| `@mr/core-i18n/translation-set` | `modules/translation-set.ts` | `TranslationSet` |
| `@mr/core-i18n/value` | `modules/value/index.ts` | `TPluralKey` |
| `@mr/core-i18n/value/singular-value` | `modules/value/singular-value.ts` | `SingularValue` |
| `@mr/core-i18n/value/plural-value` | `modules/value/plural-value.ts` | `PluralValue`, `TPluralFunction` |
| `@mr/core-i18n/util/lang` | `modules/util/lang.ts` | `getLang()` |
| `@mr/core-i18n/util/plural-function-builder` | `modules/util/plural-function-builder.ts` | el builder, por defecto |

**La ruta publica no coincide con la del fichero, y es deliberado**: el `modules/` de delante no
aparece en ninguna. La excepcion es `./tsconfig.json`, que lleva extension porque es literalmente
lo que se escribe en un `extends` — mismo criterio que en `@mr/core-dev`. El puente es el mapa `exports`, con **clave sin extension y destino con ella**,
que es el patron del resto de la familia (`@mr/core-utils`, `@mr/core-dev`, `@mr/core-cli`).

### Lo que NO se exporta, y por que

| Fichero | Que hay dentro | Por que se queda dentro |
|---------|----------------|-------------------------|
| `modules/index.ts` | `Translation`, la base abstracta de `Literal`/`TranslationMap`/`TranslationSet` | Detalle de implementacion: nadie la extiende desde fuera |
| `modules/value/value.ts` | `Value` y `TParams` | Igual: es la base de los dos `Value` concretos |
| `modules/example.ts` | Una demo con `console.log` en el cuerpo | No es API. Y ejecuta al importarse, asi que mejor que no se pueda |

Se comprobo antes de decidirlo: de las ocho rutas que emite el generador y del unico import a mano
del monorepo, ninguna pide estos tres. Con `exports` declarado, ademas, ya no se **puede**
importarlos de fuera aunque el fichero exista.

> Al anadir un modulo nuevo a `modules/`, no se ve desde fuera hasta que se anade su clave aqui.
> Y si lo va a emitir el generador, hay que tocarlo tambien a el: `src/clases-v2/modulo/`.

Asi el fichero se puede mover dentro del paquete sin tocar a los consumidores. Es el patron ya
establecido en la familia `@mr/core-*`: `@mr/core-utils` mapea `"./config": "./src/config.ts"`
y `@mr/core-dev` mapea sus veinte subrutas de `manifest/` igual — **clave sin extension,
destino con ella**.

Dos consecuencias que conviene tener presentes:

1. Declarar `exports` **cierra** el paquete: lo que no esta en el mapa deja de ser importable
   desde fuera, aunque el fichero exista. Un modulo nuevo en `modules/` no se ve hasta que se
   anade su clave.
2. La resolucion se ha comprobado en los dos planos, no solo en el de tipos:
   `require.resolve("@mr/core-i18n/langs")` desde un workspace que declara la dependencia
   devuelve `@mr/core/i18n/modules/langs.ts`, y `tsc --noEmit` pasa en los tres paquetes que lo
   importan (`@mr/core-network`, `@mr/cli`, `services-comun`) — comprobado antes de que `mrlang`
   se mudara aqui, cuando `@mr/cli` todavia importaba `soportados`.

### Tipos exportados

- `IdiomaCorto`
  - Union literal de 40 codigos ISO 639-1
  - Ejemplos: `"es"`, `"en"`, `"pt"`, `"fil"`, `"ur"`
  - **Uno no es de dos letras**: `"fil"`. Ver el aviso de `corto`
- `IdiomaLargo`
  - Union literal de 26 codigos BCP 47 (`idioma-REGION`)
  - Ejemplos: `"es-ES"`, `"es-MX"`, `"pt-BR"`, `"en-GB"`, `"ru-RU"`
  - Solo `idioma-REGION`: no caben las variantes con subetiqueta (`ca-ES-valencia`)
- `Idioma`
  - `IdiomaCorto | IdiomaLargo`

### Valores y funciones exportadas

- `soportados: Idioma[]`
  - Array canonico con todos los idiomas validos
  - **66 entradas** (40 cortos + 26 largos), sin repetidos
- `soportado(lang: Idioma): boolean`
  - Valida pertenencia a `soportados`
  - No es guarda de tipo: devuelve `boolean`, no `lang is Idioma`
- `corto(idioma: Idioma): IdiomaCorto`
  - Devuelve los dos primeros caracteres del codigo (`slice(0, 2)`)

## Detalle de implementacion (`modules/langs.ts`)

### `soportados`

Construido como lista literal en dos bloques:

1. Bloque de codigos cortos
2. Bloque de variantes largas regionales

Esto permite:

- Validacion simple por `includes`
- Tipado estricto en compile-time
- Reutilizacion en routing, i18n HTTP y config por idioma en otros paquetes

**El array y las dos uniones se mantienen a mano y pueden divergir**: nada obliga a que
coincidan, porque `soportados` esta anotado como `Idioma[]` y no derivado de las uniones. Hoy
estan sincronizados —comprobado: ni sobra ni falta ningun codigo en ninguno de los dos
sentidos—, pero es una invariante de mantenimiento, no del compilador.

### `soportado`

```ts
export const soportado = (lang: Idioma): boolean => soportados.includes(lang);
```

- Complejidad O(n)
- Mantiene semantica directa y unica fuente de verdad en `soportados`
- El parametro es `Idioma`, asi que para validar una cadena que llega de fuera —el caso para el
  que existe la funcion— hay que castear antes de preguntar

### `corto`

```ts
export const corto = (idioma: Idioma): IdiomaCorto => idioma.slice(0, 2) as IdiomaCorto;
```

- Normaliza variantes regionales al idioma base
- Ejemplos:
  - `"es-ES" -> "es"`
  - `"pt-BR" -> "pt"`
  - `"en" -> "en"`

**Trampa conocida: `corto("fil") -> "fi"`.** `"fil"` es filipino y `"fi"` es fines, y `"fi"`
esta tambien en la lista de soportados, asi que el resultado es un idioma **valido y
equivocado**: no lanza, no devuelve `undefined` y el tipo declarado se cumple. Comprobado
ejecutandolo. No hay incidencia porque `corto()` **no tiene ningun llamante en el monorepo**;
si algun dia se sirve filipino, hay que arreglar la funcion antes de usarla.

## Dependencias

- `dependencies`: `chokidar`, `source-map-support`, `tslib` — **las tres son del CLI**, no de los
  idiomas ni del runtime, que no importan nada de fuera de `node:`.
- `devDependencies`: `@mr/core-cli`, `@tsconfig/node24`, `@types/node`,
  `@types/source-map-support`, `esbuild`, `typescript`.

**Sin `@mr/core-dev`.** Lo unico que aportaba era el `tsconfig` base y unos tipos globales del
bundler (`PRODUCCION`, `ENTORNO`, …) que este paquete no usa —comprobado antes de quitarlos—. El
`tsconfig.json` extiende ahora **`@tsconfig/node24` directamente**, que es lo que habia al final de
aquella cadena, y solo declara encima lo que el monorepo cambia sobre esa base. La configuracion
resuelta sale identica, opcion por opcion, a la de antes.

> El precio es que este `tsconfig` deja de heredar los cambios del base del monorepo, y aqui pesa
> mas que en otros paquetes: se **exporta** como `@mr/core-i18n/tsconfig.json` y lo extiende el
> workspace `i18n/` de cada proyecto, asi que un cambio en el base ya no les llega por esta via.
> Lo que si siguen heredando es la base de Node 24, que viene de upstream.

**Sin `services-comun`.** Lo tuvo mientras el generador v1 dependia de el, y eran tres cosas
pequenas:

| Venia de | Que era | Donde esta ahora |
|----------|---------|------------------|
| `services-comun/modules/utiles/colors` | `Colors` | `@mr/core-cli/colors`, que ya usaban otros cuatro ficheros del mismo CLI |
| `services-comun/modules/utiles/fecha` | `Fecha.generarVersion()` | `generarVersion()`, privada en `src/clases/modulo/json.ts` — dos lineas |
| `services-comun/modules/traduccion/set` | el tipo `TValor` | `src/clases/modulo/traduccion/set/index.ts` — una linea |

Lo que **parecian** diez usos del runtime v1 eran nueve cadenas dentro de template literals: los
imports que el generador v1 *escribe* en el codigo que produce, no los suyos. El codigo generado
por v1 sigue importando `services-comun/modules/traduccion/*`, y por eso `mrlang init` sigue
declarando `services-comun` en el `i18n/package.json` de los proyectos — el generado por **v2** ya
no lo menciona.

> `generarVersion()` se comprobo contra el original sobre 200.005 fechas (los casos de borde a mano
> y el resto aleatorias en un rango de 60 anos): cero diferencias.

## Consumidores

Quien importa que, hoy:

| Simbolo | Consumidor |
|---------|------------|
| `Idioma`, `IdiomaCorto` (solo tipos) | `@mr/core-network`: `route/index.ts`, `route/factory/exact/index.ts`, `server/http/i18n.ts` |
| `Idioma`, `IdiomaCorto` (solo tipos) | `services-comun`: `modules/utiles/idioma.ts` |
| `soportados` (unico import de valor) | el `mrlang` de este mismo workspace: `src/clases/init.ts`, como `langs` por defecto cuando no se puede leer el `i18n/package.json` del proyecto. Import relativo (`../../modules/langs`), no por nombre de paquete |
| `soportado`, `corto` | sin llamantes |
| El **runtime** (`literal`, `value/*`, `util/*`, `translation-*`) | el **codigo generado** en `i18n/.src/` de cada proyecto: 4.396 imports a `literal`, 4.260 a `value/singular-value`, 212 a cada uno de `value`, `value/plural-value` y `util/plural-function-builder`, 86 a `translation-map`, 70 a `util/lang` y 35 a `translation-set` (cifras de este repo) |
| `tsconfig.json` | el workspace `i18n/` de cada proyecto, en su `extends` |
| `TranslationMap` (solo tipo) | `status-frontend`: `component/session/permission-rules.ts` — el unico consumidor **a mano** del runtime en todo el monorepo |

El runtime lo consume casi en exclusiva codigo que nadie escribe. La consecuencia practica: para
saber si un cambio aqui rompe algo, lo que hay que mirar es `src/clases-v2/modulo/`, que es quien
decide que se importa, y despues regenerar.

Del resto, lo que se consume de verdad son **los tipos y el array**. Las dos funciones estan exportadas y
sin usar, que es justo por lo que la trampa del `"fil"` no ha dado nunca la cara.

**No confundir `corto()` con `parseIdioma()`**, de `services-comun/modules/utiles/idioma.ts`:
suenan a lo mismo y no hacen lo mismo. `parseIdioma()` solo recorta cuando el sufijo es
numerico (`es_123 -> es`), asi que deja `"es-ES"` intacto donde `corto()` devolveria `"es"`.

## El CLI (`src/` + `bin/`)

Mapa detallado en [`src/CODEMAP.md`](./src/CODEMAP.md). Aqui solo lo que hace falta saber desde
fuera:

| Pieza | Que es |
|-------|--------|
| `bin/mrlang.js` | Entrada. Fija `MRPACK_ROOT` desde su `__dirname` y delega en `@mr/core-cli/arranque`, que ejecuta `bin/min/mrlang-run.js` y lo compila si no existe |
| `bin/min/` | Bundle generado por esbuild. Gitignored, y **no se envía** con el framework |
| `bin/hash.md5` | El md5 de `bin/min/` de la última compilación. Lo compara `mrpack` al arrancar para saber si hay que rehacer el bundle |
| `bin/.mr-ignore` | `min` — el bundle no viaja en el envío |
| `bin/.mr-nohash` | `hash.md5` — viaja, pero recompilar en local no marca el paquete como modificado |
| `src/main.ts` | `chdir` a `MRPACK_ROOT` y `MRLang.run()` |
| `src/esbuild.config.mjs` | Build: bundlea los workspace devDeps, deja fuera las `dependencies` |

**El bundle se rehace solo.** El arranque compila cuando **falta**, y `mrpack` cuando esta
**viejo**: compara `bin/hash.md5` con el md5 de `bin/min/` en `devel`/`update`/`init` y al terminar
una tanda del gestor de frameworks (`checkMrlang()`, en
`@mr/cli/src/clases/framework/cliente.ts`). Lo que dispara la recompilacion tras una
actualizacion es que el `hash.md5` recibido —del que envio— no cuadra con el bundle local; sin
fichero de hash tambien recompila, para sembrarlo.

**La profundidad del workspace importa y esta escrita en un solo sitio.** `@mr/core/i18n` cuelga
de tres niveles de la raiz del monorepo, mientras que `@mr/cli` colgaba de dos, asi que
`bin/mrlang.js` resuelve `../../../..` y no `../../..`. `src/main.ts` **no** cuenta `..` por su
cuenta: usa `MRPACK_ROOT`, que es lo que evita tener la misma cuenta en dos ficheros.

Dos rutas del CLI se resuelven contra la raiz del monorepo, que es el cwd tras ese `chdir`:

- El catalogo de idiomas, `src/clases-v2/lang/assets/langs.json`, que `Lang.loadCatalog()` lee
  como `@mr/core/i18n/src/clases-v2/lang/assets/langs.json`. No se puede resolver contra
  `__dirname` porque el bundle vive en `bin/min/` y el asset se queda en `src/`.
- Las rutas de `i18n/.json` e `i18n/.src` del proyecto.

## Flujo de uso tipico

```text
Entrada externa de idioma
  -> soportado(idioma) para validar
  -> corto(idioma) para agrupar por base linguistica
  -> consumo en routing/configuracion por idioma
```

## Pruebas (`spec/`)

Las del runtime v2, en el mismo arnes que `services-comun`: ejecutor de `node:test` sobre lo que
compila el `typescript` del workspace, sin dependencias nuevas.

```bash
yarn workspace @mr/core-i18n test
```

34 pruebas en cinco ficheros (`lang`, `plural-value`, `translation-map`, `translation-set`,
`value`). Vinieron de `services-comun/spec/traduccion/v2/` con el codigo que prueban.

> **`tmp/spec` no se limpia entre ejecuciones.** El script compila con `tsc -p tsconfig.spec.json`
> y lanza `node --test "tmp/spec/**/*.spec.js"`, asi que un `.spec.ts` borrado sigue ejecutandose
> desde su `.js` viejo hasta que alguien vacia el directorio. Paso al mover estas pruebas:
> `services-comun` seguia contando 43 con las 34 ya fuera. Si un recuento no cuadra, `rm -rf
> tmp/spec` antes de sacar conclusiones.

## Mantenimiento

Si se agregan o retiran idiomas:

1. Actualizar unions `IdiomaCorto` y/o `IdiomaLargo`
2. Mantener sincronizada la lista `soportados` — el compilador no lo comprueba
3. Verificar documentacion en `README.md`
4. Actualizar este CODEMAP con los nuevos conteos y ejemplos

Sobre el punto 4: **los conteos se escriben mal con facilidad**. El README, este CODEMAP y el
CHANGELOG decian los tres «24 largos, 64 totales» desde el primer dia, cuando el fichero nunca
ha tenido menos de 26 y 66 — el listado del README si estaba completo, era solo el numero el
que estaba mal. No se cuentan a ojo:

```bash
python3 - <<'PY'
import re, io
s = io.open("@mr/core/i18n/modules/langs.ts", encoding="utf-8").read()
u = lambda n: re.findall(r'"([^"]+)"', re.search(rf"export type {n} =(.*?);", s, re.S).group(1))
sop = re.findall(r'"([^"]+)"', re.search(r"export const soportados: Idioma\[\] = \[(.*?)\];", s, re.S).group(1))
print("cortos", len(u("IdiomaCorto")), "largos", len(u("IdiomaLargo")), "soportados", len(sop))
print("descuadre:", set(u("IdiomaCorto") + u("IdiomaLargo")) ^ set(sop) or "ninguno")
PY
```

Si se anade un idioma cuyo codigo corto no sea de dos letras, hay que revisar `corto()` — hoy
solo lo incumple `"fil"`, y sin consecuencias porque nadie la llama.
