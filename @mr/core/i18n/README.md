# `@mr/core-i18n`

Internacionalización del monorepo, de punta a punta. El paquete tiene **tres piezas**:

| | Qué | Quién lo usa |
|---|-----|--------------|
| **Los idiomas** (`modules/langs.ts`) | La definición canónica: tipos, lista de soportados y dos helpers | Otros paquetes, por `@mr/core-i18n/langs` |
| **El runtime** (`modules/`) | Las clases que instancia el código traducido: `Literal`, `TranslationMap`, `TranslationSet`, los `Value` y los plurales | El código generado en `i18n/.src/`, y con él cada servicio |
| **El generador** (`src/`, `bin/`) | `mrlang`, que produce ese código a partir de los `.json` | Personas, por `yarn mrlang` |

Que las tres vivan juntas es el sentido del paquete: **el generador escribe imports al runtime que
tiene al lado**. El runtime estuvo en `services-comun` hasta el 2026-09-04, lo que obligaba a que
un cambio en el formato generado se repartiera entre dos paquetes de framework con envíos
independientes.

Aun así se tocan poco entre ellas: `mrlang init` lee `soportados` de `langs.ts`, y nada más. Y el
mapa `exports` publica **solo** lo que se importa de fuera, así que quien viene por los tipos de
idioma no arrastra el resto.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

## Los idiomas

Proporciona la definición canónica de los idiomas soportados por el sistema, incluyendo
códigos cortos (ISO 639-1) y largos (BCP 47), la lista completa de variantes activas y
dos helpers: `soportado()` y `corto()`.

---

## Contenido

Es un único fichero, `modules/langs.ts`, con una única ruta pública:

```ts
import {
    soportados,
    soportado,
    corto,
} from "@mr/core-i18n/langs";

import type {Idioma, IdiomaCorto, IdiomaLargo} from "@mr/core-i18n/langs";
```

**La ruta de import no lleva la ruta real del fichero, y es a propósito.** El fuente vive en
`modules/langs.ts`, pero lo que se escribe es `@mr/core-i18n/langs`, sin `modules/` y sin
extensión. Lo hace posible el mapa `exports` del `package.json`:

```json
"exports": {
    "./langs": "./modules/langs.ts"
}
```

Con eso, mover el fichero dentro del paquete no rompe a nadie: la ruta pública es una decisión
del `package.json` y no un reflejo del árbol de directorios. Es el mismo patrón que usan
`@mr/core-utils` (`"./config": "./src/config.ts"`) y `@mr/core-dev`, que mapea sus veinte
subrutas de `manifest/` de la misma forma — la clave va sin extensión y el destino con ella.

> Ojo si se añade una ruta: **con `exports` declarado, lo que no esté en el mapa deja de ser
> importable**. Hoy el paquete exporta una sola cosa, así que la lista es de una línea, pero un
> fichero nuevo en `modules/` no se ve desde fuera hasta que aparece aquí.

---

## Tipos

### `IdiomaCorto`

Código ISO 639-1 de dos letras. Representa el subconjunto corto usado internamente
para agrupar variantes regionales.

```ts
type IdiomaCorto =
    "ar" | "bn" | "ca" | "cs" | "da" | "de" | "el" | "en" | "es" | "eu" |
    "fa" | "fi" | "fil" | "fr" | "gl" | "he" | "hi" | "hr" | "hu" | "id" |
    "it" | "ja" | "ko" | "ms" | "my" | "nb" | "nl" | "no" | "pl" | "pt" |
    "ro" | "ru" | "sk" | "sv" | "sw" | "th" | "tl" | "tr" | "ur" | "vi";
```

Son 40, y **uno de ellos no es de dos letras**: `"fil"` (filipino). Importa, porque `corto()`
corta por los dos primeros caracteres — ver el aviso más abajo.

### `IdiomaLargo`

Código BCP 47 con variante regional (`idioma-REGIÓN`). Se usa cuando el servicio
necesita distinguir entre variantes del mismo idioma base.

```ts
type IdiomaLargo =
    | "da-DK"
    | "de-AT" | "de-DE"
    | "en-CA" | "en-GB" | "en-US"
    | "es-AR" | "es-BO" | "es-CL" | "es-CR" | "es-DO" | "es-EC"
    | "es-ES" | "es-HN" | "es-MX" | "es-PA" | "es-PE" | "es-PY" | "es-UY" | "es-VE"
    | "fr-FR"
    | "it-IT"
    | "nl-NL"
    | "pt-BR" | "pt-PT"
    | "ru-RU";
```

Son 26. No hay ninguna variante que no sea `idioma-REGIÓN`: las variantes con subetiqueta
—`ca-ES-valencia` y compañía— no caben en este tipo ni en la lista.

### `Idioma`

Unión de `IdiomaCorto` e `IdiomaLargo`. Tipo principal para cualquier código de idioma
válido en el sistema.

```ts
type Idioma = IdiomaCorto | IdiomaLargo;
```

---

## Constantes y funciones

### `soportados: Idioma[]`

Lista completa de todos los idiomas (cortos y largos) soportados: **40 códigos cortos y 26
variantes regionales, 66 entradas**. Sin repetidos, y sin nada que no esté también en las dos
uniones — las tres listas están hoy sincronizadas.

```ts
import {soportados} from "@mr/core-i18n/langs";

soportados.includes("es");     // true
soportados.includes("es-ES");  // true
soportados.includes("zh");     // false
```

### `soportado(lang): boolean`

Comprueba si un código de idioma pertenece a la lista de idiomas soportados.

```ts
import {soportado} from "@mr/core-i18n/langs";

soportado("pt-BR"); // true
soportado("zh-CN"); // false
```

El parámetro está tipado como `Idioma`, así que para preguntarle por una cadena cualquiera
—que es el caso interesante, validar lo que llega de fuera— hay que hacerle un cast antes. No
es una guarda de tipo: devuelve `boolean`, no `lang is Idioma`.

### `corto(idioma): IdiomaCorto`

Extrae el código corto ISO 639-1 de un idioma largo o corto, tomando los dos primeros
caracteres.

```ts
import {corto} from "@mr/core-i18n/langs";

corto("es-ES"); // "es"
corto("pt-BR"); // "pt"
corto("en");    // "en"
```

> **`corto("fil")` devuelve `"fi"`, que es finés.** Es el único código corto de tres letras de
> la lista, y `slice(0, 2)` lo convierte en otro idioma **que también está soportado**, así que
> nada aguas abajo puede detectar el cambiazo: no lanza, no devuelve `undefined` y el tipo
> sigue siendo `IdiomaCorto`. Comprobado ejecutándolo. Si algún día se sirve filipino, hay que
> arreglar `corto()` antes; mientras tanto, es una trampa dormida y no un fallo en producción.
> (El filipino tiene además una segunda entrada por la vía tagalo, `"tl"`, que sí sobrevive
> al recorte.)

---

## Quién lo usa

Conviene saberlo antes de tocar nada, porque la superficie que se usa de verdad es más
estrecha de lo que sugiere la lista de exports:

| Qué | Quién |
|-----|-------|
| `Idioma`, `IdiomaCorto` (**solo tipos**) | `@mr/core-network` (`route/index.ts`, `route/factory/exact/index.ts`, `server/http/i18n.ts`) y `services-comun` (`modules/utiles/idioma.ts`) |
| `soportados` (**el único import de valor**) | el propio `mrlang` (`src/clases/init.ts`), como lista de idiomas por defecto cuando no se puede leer el `i18n/package.json` del proyecto. Import relativo, no por nombre de paquete: está dentro del mismo workspace |
| `soportado()`, `corto()` | nadie, hoy |

Que los dos helpers no tengan ni una llamada explica por qué la trampa del `"fil"` ha podido
estar ahí sin dar guerra, y también que el valor real del paquete sea la unión de tipos y el
array — no las funciones.

**Y hay un segundo normalizador que no es este.** `services-comun` tiene
`parseIdioma()` en `modules/utiles/idioma.ts`, y **no hace lo mismo**: solo recorta cuando el
sufijo es numérico (`es_123` → `es`), así que `parseIdioma("es-ES")` devuelve `"es-ES"` donde
`corto("es-ES")` devuelve `"es"`. No son intercambiables aunque lo parezcan por el nombre.

---

## El runtime de traducciones

Lo que instancia el código generado. Nueve rutas, todas en el mapa `exports`:

| Ruta | Qué exporta |
|------|-------------|
| `@mr/core-i18n/literal` | `Literal` — un texto, con o sin parámetros |
| `@mr/core-i18n/translation-map` | `TranslationMap` — diccionario clave→texto, con `.get()` y `.uGet()` |
| `@mr/core-i18n/translation-set` | `TranslationSet` — colección ordenada |
| `@mr/core-i18n/value` | `TPluralKey` — las categorías CLDR |
| `@mr/core-i18n/value/singular-value` | `SingularValue` |
| `@mr/core-i18n/value/plural-value` | `PluralValue` |
| `@mr/core-i18n/util/lang` | `getLang()` — resuelve el idioma pedido contra los que declara un módulo |
| `@mr/core-i18n/util/plural-function-builder` | el constructor de reglas de plural sobre `Intl.PluralRules` |

**Lo que no está en esa tabla es interno**, y a propósito: `modules/index.ts` (la clase base
`Translation`, de la que heredan las tres de arriba), `modules/value/value.ts` (`Value` y
`TParams`) y `modules/example.ts`. Nadie los importaba de fuera, y con `exports` declarado dejan
de poder importarse — que es lo que se quería.

No se escriben a mano. Los emite `mrlang generate`, y quien decide qué ruta va en cada fichero
generado es `src/clases-v2/modulo/`. **Si aquí se renombra algo, hay que tocar el generador**, o el
código generado seguirá pidiendo lo que ya no existe.

## El CLI: `mrlang`

El generador de traducciones. Vive en `src/`, se compila a `bin/min/mrlang-run.js` y se invoca de
tres formas equivalentes:

```bash
yarn mrlang generate -v2                    # el bin de la raíz
yarn workspace @mr/core-i18n mrlang generate -v2
yarn run i18n run generate                  # el atajo del workspace de traducciones
```

**Dos comandos: `generate` e `init`.** Hubo tres más —`pull`, `push` y `fremote`—, del generador v1,
que además de en JSON persistía las traducciones en MySQL. No se usaban, y se retiraron con todo el
MySQL: diez ficheros, tres dependencias npm y 24 kB de bundle menos.

**Vivía en `@mr/cli` junto a `mrpack`.** Se separó para que cada CLI tuviera su workspace; lo que
las dos compartían está ahora en [`@mr/core-cli`](../cli/README.md), del que ambas dependen sin
conocerse entre sí.

Cómo se escriben y organizan las traducciones —el flujo de `.json` a `.src`, los tres tipos de
entrada, los plurales— no se documenta aquí sino en el `readme.md` del workspace `i18n/` de cada
proyecto, que es donde se trabaja. Aquí está el mapa del código: [`src/CODEMAP.md`](./src/CODEMAP.md).

### Compilación

```bash
yarn workspace @mr/core-i18n run compile          # una vez
yarn workspace @mr/core-i18n run compile:watch    # en watch
```

No hace falta lanzarlo a mano: el arranque (`@mr/core-cli/arranque`) compila la primera vez que no encuentra
`bin/min/mrlang-run.js`. esbuild bundlea los workspace devDeps (`@mr/core-cli`) y deja fuera las
`dependencies`, que se resuelven en runtime.

**El paquete no depende de `services-comun`.** Lo hizo mientras el generador v1 tiraba de él, y
eran tres cosas: `Colors` —que pasa al de `@mr/core-cli`, ya usado por otros cuatro ficheros de
este mismo CLI—, `Fecha.generarVersion()` (dos líneas, ahora privada en `clases/modulo/json.ts`) y
el tipo `TValor` (una línea). Ojo con el grep: parecían diez usos del runtime v1, pero nueve están
**dentro de template literals** — son los imports que el generador *escribe* en el código que
produce, no los suyos.

### El bundle se rehace solo cuando toca

`bin/hash.md5` guarda el md5 de `bin/min/` de la última compilación. `mrpack` lo compara al
arrancar —en `devel`, `update` e `init`, y al terminar una tanda del gestor de frameworks— y si no
cuadra, recompila en modo producción y vuelve a anotarlo.

Hace falta porque **el arranque solo compila cuando el bundle falta, no cuando está viejo**: tras
actualizar el paquete, `mrlang` seguiría ejecutando el anterior sin que nada lo delatara. Mientras
las dos CLI compartieron workspace no se notaba, porque `mrlang` se compilaba con `mrpack` en la
misma pasada.

De este directorio **`bin/min/` no se envía** con el framework: cada repo compila el suyo. Lo que
viaja es `hash.md5`, 32 bytes, y es justo lo que dispara la recompilación — el hash de quien envió
no coincide con el bundle local. Va en `.mr-nohash` para que recompilar en local no haga que el
paquete parezca modificado.

> **`bin/mrlang.js` cuenta cuatro niveles hasta la raíz del monorepo, no tres.** Este workspace
> cuelga de `@mr/core/`, mientras que `@mr/cli` colgaba directamente de `@mr/`. Esa cuenta vive en
> un solo sitio: el bin fija `MRPACK_ROOT` y `src/main.ts` hace el `chdir` con esa variable en vez
> de con un relativo propio.

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.
