# `@mr/core-i18n`

Tipos y utilidades de internacionalización compartidos por todos los paquetes del monorepo.

Proporciona la definición canónica de los idiomas soportados por el sistema, incluyendo
códigos cortos (ISO 639-1) y largos (BCP 47), la lista completa de variantes activas y
dos helpers de uso frecuente: `soportado()` y `corto()`.

---

## Contenido

El paquete expone un único fichero de entrada: `langs.ts`.

```ts
import {
    soportados,
    soportado,
    corto,
} from "@mr/core-i18n/langs";

import type {Idioma, IdiomaCorto, IdiomaLargo} from "@mr/core-i18n/langs";
```

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

### `Idioma`

Unión de `IdiomaCorto` e `IdiomaLargo`. Tipo principal para cualquier código de idioma
válido en el sistema.

```ts
type Idioma = IdiomaCorto | IdiomaLargo;
```

---

## Constantes y funciones

### `soportados: Idioma[]`

Lista completa de todos los idiomas (cortos y largos) soportados. Incluye 40 códigos
cortos y 24 variantes regionales (64 entradas en total). Se usa para validar el segmento
de idioma en el path de las URLs.

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

### `corto(idioma): IdiomaCorto`

Extrae el código corto ISO 639-1 de un idioma largo o corto, tomando los dos primeros
caracteres.

```ts
import {corto} from "@mr/core-i18n/langs";

corto("es-ES"); // "es"
corto("pt-BR"); // "pt"
corto("en");    // "en"
```

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.

