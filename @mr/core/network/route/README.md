# `@mr/core-network/route`

Modela una sección de la aplicación: agrupa la configuración de URLs por idioma, las expresiones de routing y la lógica de ejecución de handlers de petición.

> **Origen:** este módulo se trasladó desde `@mr/core-templates/seccion` para centralizar en `@mr/core-network` todas las primitivas relacionadas con el enrutado HTTP.

---

## Estructura

| Fichero | Descripción |
|---------|-------------|
| `index.ts` | Clase `Route` y tipos base. Re-exporta también `crearExactGET` e `ICrearExactOptions` desde `factory/` para mantener compatibilidad de imports. |
| `factory/exact/index.ts` | Interfaz `ICrearExactOptions` — opciones para construir rutas exactas. |
| `factory/exact/get.ts` | Default export — función `crearExactGET`, factory para rutas de URL exacta con método GET. |

---

## Importación

Todos los símbolos públicos están disponibles desde la entrada raíz:

```ts
import {Route, crearExactGET} from "@mr/core-network/route";
import type {
    IRoute, IRouteOptions, IRouteBuilderOptions,
    TRouteRunner, TParams, ICrearExactOptions,
} from "@mr/core-network/route";
```

O directamente desde los sub-módulos de factory:

```ts
import type {ICrearExactOptions} from "@mr/core-network/route/factory/exact";
import crearExactGET from "@mr/core-network/route/factory/exact/get";
```

---

## Tipos y interfaces

### `TParams`

```ts
type TParams = Partial<Record<string, string>>;
```

Mapa de parámetros extraídos de la URL (e.g. `{pais: "spain", ciudad: "madrid"}`).

### `IRoute`

Descriptor plano con el que se instancia una `Route`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `nombre` | `string` | Identificador único de la ruta. |
| `expresiones` | `IExpresion[] \| undefined` | Reglas de routing (dominio, método HTTP, idioma, patrón de URL). |
| `idiomas` | `Idioma[] \| undefined` | Idiomas soportados. Si se omite, hereda todos los idiomas del dominio. |
| `idiomaDefecto` | `Idioma \| undefined` | Idioma por defecto. Si se omite, se usa `"en"` o el primer idioma disponible. |
| `url.defecto` | `string` | Patrón de URL base (e.g. `"/weather/{ciudad}"`). Los parámetros se expresan con `{nombre}`. |
| `url.lang` | `Partial<Record<Idioma, string>> \| undefined` | Patrones de URL alternativos por idioma. |

### `IRouteOptions`

Opciones para `Route.run()`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `checkLang` | `boolean \| undefined` | Si `true` (por defecto), verifica que el idioma de la petición esté entre los soportados por la ruta. |
| `params` | `Record<string, string \| undefined> \| string[] \| undefined` | Parámetros de URL. Si es un array, se mapean posicionalmente a los nombres declarados en `url.defecto`. Si es un objeto, se usa directamente. |

### `IRouteBuilderOptions`

Contexto de petición que recibe el runner en `Route.run()`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `lang` | `Idioma` | Idioma activo de la petición. |
| `dominio` | `string` | Valor de `request.headers.host` de la petición entrante. |
| `url` | `string` | URL completa de la petición. |
| `device` | `TDevice` | Tipo de dispositivo detectado (`pc` / `mv`). |
| `section` | `Route` | Instancia de la ruta que está procesando la petición. |
| `params` | `Record<string, string \| undefined>` | Parámetros de URL extraídos y normalizados como mapa clave→valor. |

### `TRouteRunner<C, T>`

```ts
type TRouteRunner<C extends Configuracion, T> =
    (config: C, options: IRouteBuilderOptions) => Promise<T>;
```

Función de handler que ejecuta la lógica de negocio de una ruta.

---

## Clase `Route`

### Propiedades públicas

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `nombre` | `string` | Nombre de la ruta. |
| `expresiones` | `IExpresion[]` | Reglas de routing asociadas. |
| `idiomas` | `Idioma[]` | Idiomas soportados. |
| `idiomaDefecto` | `Idioma` | Idioma por defecto. |

### Métodos públicos

| Método | Descripción |
|--------|-------------|
| `checkLang(lang: Idioma): boolean` | Devuelve `true` si el idioma está soportado por la ruta. |
| `getPath(lang: Idioma, params?: TParams): string` | Devuelve el patrón de URL para el idioma dado, sustituyendo los parámetros `{nombre}`. El resultado sin parámetros se cachea por idioma. |
| `getURL(lang: Idioma, opts?: {idioma?, params?, subdominio?}): string` | Devuelve la URL absoluta completa (dominio + path traducido). |
| `run<C, P>(conexion, config, runner, opts?): Promise<P>` | Valida el idioma, normaliza los parámetros y delega en el `runner`. Registra y propaga el error si el runner falla. |
| `redir(_conexion: Conexion): Promise<string>` | Override point para redireccionamientos. Lanza `Error("Handler not defined")` si no se sobreescribe. |

---

## `factory/exact/index.ts` — `ICrearExactOptions`

**Entrada:** `@mr/core-network/route/factory/exact`

Interfaz de opciones para construir rutas exactas.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `dominio` | `Dominio` | Instancia de dominio del servicio. |
| `dominios` | `string[] \| undefined` | Hosts que aceptan esta ruta. Si se omite, se usan `dominio.BASE` y `dominio.WWW`. |
| `idiomas` | `Idioma[]` | Idiomas soportados por la ruta. |
| `metodos` | `TMetodo[] \| undefined` | Métodos HTTP permitidos. Por defecto `["GET"]`. |

---

## `factory/exact/get.ts` — `crearExactGET`

**Entrada:** `@mr/core-network/route/factory/exact/get` (default export)

Crea una `Route` para una URL exacta con método GET. Es la forma más concisa de registrar una ruta simple sin parámetros de URL variables.

```ts
import crearExactGET from "@mr/core-network/route/factory/exact/get";
// o desde la raíz (recomendado):
import {crearExactGET} from "@mr/core-network/route";

const rutaHome = crearExactGET("home", "/", {dominio, idiomas: ["es", "en"]});
```

---

## Uso

### Definir rutas

```ts
import {Route, crearExactGET} from "@mr/core-network/route";

// Ruta de URL exacta (más simple)
const rutaHome = crearExactGET("home", "/", {dominio, idiomas: ["es", "en"]});

// Ruta con parámetros de URL
const rutaLocalidad = new Route({dominio, idiomas: ["es", "en"]}, {
    nombre: "localidad",
    idiomas: ["es", "en"],
    url: {
        defecto: "/weather/{pais}/{ciudad}",
        lang: {
            en: "/weather/{pais}/{ciudad}",
        },
    },
});
```

### Ejecutar el handler de una ruta

```ts
const resultado = await rutaLocalidad.run(
    conexion,
    config,
    async (cfg, {lang, params, device}) => {
        const pagina = await PaginaLocalidad.build({...cfg, lang, device, params});
        await pagina.render();
        return pagina;
    },
    {params: conexion.params},
);
```

### Obtener URLs

```ts
// URL absoluta en el idioma de la petición
const url = rutaLocalidad.getURL(lang, {
    params: {pais: "spain", ciudad: "madrid"},
});
// → "https://www.meteored.com/weather/spain/madrid"

// URL en idioma alternativo
const urlEn = rutaLocalidad.getURL(lang, {
    idioma: "en",
    params: {pais: "spain", ciudad: "madrid"},
});
```

### Integración con `IConfigPlantilla`

`Route` se inyecta en los componentes de plantilla como `config.section`:

```ts
import type {Route} from "@mr/core-network/route";
import type {IConfigPlantilla} from "@mr/core-templates";
// IConfigPlantilla.section: Route
```


Modela una sección de la aplicación: agrupa la configuración de URLs por idioma, las expresiones de routing y la lógica de ejecución de handlers de petición.

> **Origen:** este módulo se trasladó desde `@mr/core-templates/seccion` para centralizar en `@mr/core-network` todas las primitivas relacionadas con el enrutado HTTP.

---

## Importación

```ts
import {Route, crearExactGET} from "@mr/core-network/route";
import type {
    IRoute, IRouteOptions, IRouteBuilderOptions,
    TRouteRunner, TParams,
} from "@mr/core-network/route";
```

---

## Tipos y interfaces

### `TParams`

```ts
type TParams = Partial<Record<string, string>>;
```

Mapa de parámetros extraídos de la URL (e.g. `{pais: "spain", ciudad: "madrid"}`).

### `IRoute`

Descriptor plano con el que se instancia una `Route`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `nombre` | `string` | Identificador único de la ruta. |
| `expresiones` | `IExpresion[] \| undefined` | Reglas de routing (dominio, método HTTP, idioma, patrón de URL). |
| `idiomas` | `Idioma[] \| undefined` | Idiomas soportados. Si se omite, hereda todos los idiomas del dominio. |
| `idiomaDefecto` | `Idioma \| undefined` | Idioma por defecto. Si se omite, se usa `"en"` o el primer idioma disponible. |
| `url.defecto` | `string` | Patrón de URL base (e.g. `"/weather/{ciudad}"`). Los parámetros se expresan con `{nombre}`. |
| `url.lang` | `Partial<Record<Idioma, string>> \| undefined` | Patrones de URL alternativos por idioma. |

### `IRouteOptions`

Opciones para `Route.run()`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `checkLang` | `boolean \| undefined` | Si `true` (por defecto), verifica que el idioma de la petición esté entre los soportados. |
| `params` | `Record<string, string \| undefined> \| string[] \| undefined` | Parámetros de URL. Si es un array, se mapean posicionalmente a los nombres declarados en `url.defecto`. |

### `IRouteBuilderOptions`

Contexto de petición que recibe el runner en `Route.run()`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `lang` | `Idioma` | Idioma activo de la petición. |
| `dominio` | `string` | Dominio `host` de la petición (`request.headers.host`). |
| `url` | `string` | URL completa de la petición. |
| `device` | `TDevice` | Tipo de dispositivo detectado. |
| `section` | `Route` | Instancia de ruta activa. |
| `params` | `Record<string, string \| undefined>` | Parámetros extraídos y normalizados. |

### `TRouteRunner<C, T>`

```ts
type TRouteRunner<C extends Configuracion, T> =
    (config: C, options: IRouteBuilderOptions) => Promise<T>;
```

Función de handler que ejecuta la lógica de negocio de una ruta. Recibe la configuración de la aplicación y el contexto de la petición.

---

## Clase `Route`

### Constructor

```ts
new Route(cfg: IConfig, route: IRoute)
```

`IConfig` es interno; usar `crearExactGET` o la subclase correspondiente para construir instancias.

### Propiedades públicas

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `nombre` | `string` | Nombre de la ruta. |
| `expresiones` | `IExpresion[]` | Reglas de routing asociadas. |
| `idiomas` | `Idioma[]` | Idiomas soportados. |
| `idiomaDefecto` | `Idioma` | Idioma por defecto. |

### Métodos públicos

| Método | Descripción |
|--------|-------------|
| `checkLang(lang: Idioma): boolean` | Devuelve `true` si el idioma está soportado por la ruta. |
| `getPath(lang: Idioma, params?: TParams): string` | Devuelve el patrón de URL para el idioma dado, sustituyendo los parámetros `{nombre}` si se proporcionan. El resultado sin parámetros se cachea por idioma. |
| `getURL(lang: Idioma, opts?: {idioma?, params?, subdominio?}): string` | Devuelve la URL absoluta completa (dominio + path traducido). |
| `run<C, P>(conexion, config, runner, opts?): Promise<P>` | Valida el idioma, normaliza los parámetros y delega en el `runner`. Registra y propaga el error si el runner falla. |
| `redir(_conexion: Conexion): Promise<string>` | Override point para redireccionamientos. Lanza `Error("Handler not defined")` si no se sobreescribe. |

---

## `crearExactGET`

Función de conveniencia para crear rutas de una sola URL exacta con método `GET`.

```ts
const crearExactGET = (
    nombre: string,
    url: string,
    options: ICrearExactOptions,
) => Route;
```

### `ICrearExactOptions`

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `dominio` | `Dominio` | Instancia de dominio del servicio. |
| `dominios` | `string[] \| undefined` | Hosts que aceptan esta ruta. Si se omite, se usan `dominio.BASE` y `dominio.WWW`. |
| `idiomas` | `Idioma[]` | Idiomas soportados. |
| `metodos` | `TMetodo[] \| undefined` | Métodos HTTP permitidos. Por defecto `["GET"]`. |

---

## Uso

### Definir rutas

```ts
import {Route, crearExactGET} from "@mr/core-network/route";

// Ruta de URL exacta (más simple)
const rutaHome = crearExactGET("home", "/", {dominio, idiomas: ["es", "en"]});

// Ruta con parámetros de URL
const rutaLocalidad = new Route({dominio, idiomas: ["es", "en"]}, {
    nombre: "localidad",
    idiomas: ["es", "en"],
    url: {
        defecto: "/weather/{pais}/{ciudad}",
        lang: {
            en: "/weather/{pais}/{ciudad}",
        },
    },
});
```

### Ejecutar el handler de una ruta

```ts
const resultado = await rutaLocalidad.run(
    conexion,
    config,
    async (cfg, {lang, params, device}) => {
        const pagina = await PaginaLocalidad.build({...cfg, lang, device, params});
        await pagina.render();
        return pagina;
    },
    {params: conexion.params},
);
```

### Obtener URLs

```ts
// URL absoluta en el idioma de la petición
const url = rutaLocalidad.getURL(lang, {
    params: {pais: "spain", ciudad: "madrid"},
});
// → "https://www.meteored.com/weather/spain/madrid"

// URL en idioma alternativo
const urlEn = rutaLocalidad.getURL(lang, {
    idioma: "en",
    params: {pais: "spain", ciudad: "madrid"},
});
```

### Integración con `IConfigPlantilla`

`Route` se inyecta en los componentes de plantilla como `config.section`:

```ts
import type {Route} from "@mr/core-network/route";
import type {IConfigPlantilla} from "@mr/core-templates";
// IConfigPlantilla.section: Route
```

