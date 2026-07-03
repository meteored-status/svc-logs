# CODEMAP - `@mr/core-i18n`

Mapa tecnico del workspace `@mr/core/i18n/`.

## Objetivo

Centralizar los tipos y utilidades base de internacionalizacion del monorepo:

- Tipos de idioma corto y largo
- Union canonica de idioma (`Idioma`)
- Lista de idiomas soportados
- Helpers de validacion y normalizacion (`soportado`, `corto`)

## Arbol de modulos

```text
@mr/core/i18n/
├─ langs.ts
├─ README.md
├─ CODEMAP.md
├─ package.json
└─ tsconfig.json
```

## Superficie publica

Entrada principal: `@mr/core-i18n/langs`

### Tipos exportados

- `IdiomaCorto`
  - Union literal de 40 codigos ISO 639-1 cortos
  - Ejemplos: `"es"`, `"en"`, `"pt"`, `"fil"`, `"ur"`
- `IdiomaLargo`
  - Union literal de 24 codigos BCP 47 (`idioma-REGION`)
  - Ejemplos: `"es-ES"`, `"es-MX"`, `"pt-BR"`, `"en-GB"`, `"ru-RU"`
- `Idioma`
  - `IdiomaCorto | IdiomaLargo`

### Valores y funciones exportadas

- `soportados: Idioma[]`
  - Array canonico con todos los idiomas validos
  - Contiene 64 entradas totales (40 cortos + 24 largos)
- `soportado(lang: Idioma): boolean`
  - Valida pertenencia a `soportados`
- `corto(idioma: Idioma): IdiomaCorto`
  - Devuelve los dos primeros caracteres del codigo (`slice(0, 2)`)

## Detalle de implementacion (`langs.ts`)

### `soportados`

Construido como lista literal en dos bloques:

1. Bloque de codigos cortos
2. Bloque de variantes largas regionales

Esto permite:

- Validacion simple por `includes`
- Tipado estricto en compile-time
- Reutilizacion en routing, i18n HTTP y config por idioma en otros paquetes

### `soportado`

```ts
export const soportado = (lang: Idioma): boolean => soportados.includes(lang);
```

- Complejidad O(n)
- Mantiene semantica directa y unica fuente de verdad en `soportados`

### `corto`

```ts
export const corto = (idioma: Idioma): IdiomaCorto => idioma.slice(0, 2) as IdiomaCorto;
```

- Normaliza variantes regionales al idioma base
- Ejemplos:
  - `"es-ES" -> "es"`
  - `"pt-BR" -> "pt"`
  - `"en" -> "en"`

## Dependencias

- No tiene dependencias runtime declaradas
- `devDependencies`:
  - `@mr/core-dev` (tsconfig base)
  - `@types/node`

## Flujo de uso tipico

```text
Entrada externa de idioma
  -> soportado(idioma) para validar
  -> corto(idioma) para agrupar por base linguistica
  -> consumo en routing/configuracion por idioma
```

## Mantenimiento

Si se agregan o retiran idiomas:

1. Actualizar unions `IdiomaCorto` y/o `IdiomaLargo`
2. Mantener sincronizada la lista `soportados`
3. Verificar documentacion en `README.md`
4. Actualizar este CODEMAP con los nuevos conteos y ejemplos

