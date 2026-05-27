# `@mr/core-network/server/http`

Framework HTTP de servidor para los servicios del monorepo.

Proporciona todo lo necesario para construir un servidor HTTP/HTTPS con enrutamiento
declarativo, validación de esquemas, detección de idioma y dispositivo, integración
con WebSocket y helpers de respuesta estandarizados.

---

## Índice

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Servidor](#servidor) | `…/server` | `Server` — ciclo de vida HTTP/HTTPS con SNI multi-dominio |
| [Conexión y respuesta](#conexión-y-respuesta) | `…/conexion`, `…/respuesta` | `Conexion` / `Respuesta` — petición entrante + builder de respuesta |
| [Router](#router) | `…/router` | `route()` — despacho de peticiones a la tabla de rutas |
| [Routes](#routes) | `…/routes` | `Routes` — tabla ordenada de grupos de rutas |
| [RouteGroup](#routegroup) | `…/routes/group` | `RouteGroup` / `RouteGroupError` — grupo de rutas + WebSocket |
| [RouteGroupBlock](#routegroupblock) | `…/routes/group/block` | `RouteGroupBlock` — bloque atómico de rutas con caché y updater |
| [Checkers](#checkers) | `…/checkers` | `Checker*` — matchers de URL (regex, exact, prefix, comodín) |
| [Query checkers](#query-checkers) | `…/checkers/query` | Validadores de parámetros de query string |
| [Errores HTTP](#errores-http) | `…/error` | `HttpError*` — errores HTTP tipados (301, 404, 410, 500) |
| [i18n](#i18n) | `…/i18n` | `Idioma` — detección y resolución de idioma en el path |
| [Schema](#schema) | `…/schema/spec` | `buildSpecification` · `FieldDefinition` |
| [Schema → tipo TS](#schema--tipo-ts) | `…/schema/spec-to-type` | `SchemedType<T>` — inferencia de tipo desde esquema |
| [Validación backend](#validación-backend) | `…/schema/validation/backend` | `@validate` — decorador de validación de body |
| [ConfiguracionNet](#configuraciónnet) | `…/config/config` | `ConfiguracionNet` — configuración de servicio con red |
| [Service](#service) | `…/service` | `Service` — registro de servicios con puertos deterministas |
| [TDevice](#tdevice) | `…/config/device` | Enum de tipo de dispositivo |
| [Dominio](#dominio) | `…/config/dominio` | Gestión de dominios, subdominios y redirecciones |
| [Net](#net) | `…/config/net` | Configuración de red resuelta (puertos, endpoints, timeouts) |
| [Handlers predefinidos](#handlers-predefinidos) | `…/handlers/*` | Admin, Error, Favicon |

---

## Servidor

**Entrada:** `@mr/core-network/server/http/server`

Singleton que gestiona las instancias de `http.Server` y `https.Server`.

```ts
import server from "@mr/core-network/server/http/server";
```

### Métodos

| Método | Descripción |
|--------|-------------|
| `iniciarHTTP(routes, config)` | Crea el servidor HTTP y lo pone en escucha. Idempotente: devuelve la instancia existente si ya fue creado. |
| `iniciarHTTPs(routes, config)` | Crea el servidor HTTPS con soporte SNI multi-dominio cargando certificados desde `files/ssl/<dominio>/`. Devuelve `Promise<https.Server>`. |

### Arranque típico

```ts
import server from "@mr/core-network/server/http/server";
import {Routes} from "@mr/core-network/server/http/routes";

const routes = new Routes([miGrupo], handlerError);
server.iniciarHTTP(routes, config.net);
await server.iniciarHTTPs(routes, config.net);
```

### Certificados TLS (SNI)

Para cada subdominio se espera la estructura:

```
files/ssl/<nombre>/
  dominios.json      ← ["api.meteored.com", "www.meteored.com"]
  privkey.pem
  fullchain.pem
files/ssl/
  privkey.pem        ← certificado por defecto
  fullchain.pem
```

---

## Conexión y respuesta

### `Respuesta` (abstracta)

**Entrada:** `@mr/core-network/server/http/respuesta`

Clase base que encapsula el ciclo de vida y la construcción de una respuesta HTTP.
Gestiona cabeceras de caché, compresión (brotli, gzip, deflate), escritura por chunks
con back-pressure y reenvío de respuestas upstream.

#### Métodos clave

| Método | Descripción |
|--------|-------------|
| `setStatus(n)` | Código de estado HTTP. Por defecto 200. |
| `setCache(fecha)` / `setCache10Min()` / `setCache1Hora()` / `setCache1Dia()` / `setCache1Mes()` / `setCache1Anno()` | Fija la expiración de caché. |
| `noCache()` | Añade `private, no-cache, no-store, must-revalidate`. |
| `noTransform(remove?)` | Añade (o elimina con `true`) la directiva `no-transform`. |
| `mustRevalidate()` / `proxyRevalidate()` | Directivas de revalidación. |
| `staleWhileRevalidate(max?)` / `staleIfError(max?)` | Directivas de caché CDN. |
| `setContentType*(…)` | `JSON`, `HTML`, `CSS`, `JS`, `SVG`, `PNG`, `WebP`, `JPG`, `PDF`, `XML`, `TextPlain`, `Octet`… |
| `setETag(etag, strong?)` | Cabecera `ETag`. `strong=true` añade comillas. |
| `addVary*(…)` | `Accept-Encoding`, `User-Agent` o valor libre. |
| `setReferrerPolicy(policy)` | Cabecera `Referrer-Policy`. Usar `TReferrerPolicy.*`. |
| `addCacheTag(tag)` | Etiqueta de caché CDN (`Cache-Tag`). |
| `addCustomHeader(header, value)` | Añade o concatena un header personalizado. |
| `sendRespuesta<T>(obj)` | Serializa como JSON y envía (con compresión si está activa). |
| `sendHTML(html)` | Envía HTML con `Content-Type: text/html; charset=UTF-8`. |
| `sendDataCompress(buffer)` | Comprime con `br`/`gzip`/`deflate` según `Accept-Encoding` y envía. |
| `sendData(buffer\|null)` | Envía el buffer directamente. |
| `sendStream(stream)` | Pipe de un `ReadableStream` a la respuesta. |
| `sendCache(cache, buffer)` | Envía directamente desde caché sin reconstruir cabeceras. |
| `send301(url)` | Redirección permanente. |
| `send304()` | Not Modified (sin cuerpo). |
| `redirect(url)` | Redirección con código ya fijado (o 301 por defecto). |
| `error(status?, msg?, extra?)` | Delega en el `IErrorHandler` configurado. |
| `forwardIncomingConnection(req)` | Reenvía una respuesta upstream propagando cabeceras. |

#### Variables de servicio (estáticas)

```ts
Respuesta.SERVICE  = "mi-servicio";  // → X-Meteored-Service
Respuesta.POD      = "pod-abc123";   // → X-Meteored-Node
Respuesta.ZONA     = "eu-west";      // → X-Meteored-Zone
Respuesta.VERSION  = "2026.05.12";   // → X-Meteored-Version
```

---

### `Conexion`

**Entrada:** `@mr/core-network/server/http/conexion`

Extiende `Respuesta` añadiendo toda la información de la petición entrante.

```ts
import {Conexion} from "@mr/core-network/server/http/conexion";
```

#### Propiedades de petición

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `metodo` | `TMetodo` | Método HTTP (`GET`, `POST`…). |
| `get` | `string` | Path decodificado sin prefijo de idioma. |
| `path` | `string` | Path literal tal como llega en la URL. |
| `dominio` | `string` | Valor del header `Host`. |
| `query` | `URLSearchParams` | Parámetros de query string. |
| `queryRAW` | `string` | Query string literal (incluye `?`). |
| `post` | `NodeJS.Dict<unknown> \| unknown[]` | Cuerpo parseado (formidable / qs). Puede ser un diccionario de clave-valor o un array si el JSON enviado es de tipo array. |
| `postRAW` | `string` | Cuerpo en texto plano sin parsear. |
| `files` | `Files` | Ficheros subidos vía `multipart/form-data`. |
| `idioma` | `Idioma` | Idioma resuelto de la petición. |
| `ip` | `string` | IP remota del cliente. |
| `userAgent` | `string` | Header `User-Agent`. |
| `accept` | `string` | Header `Accept`. |
| `ifModifiedSince` | `Date\|null` | Header `If-Modified-Since`. |
| `ifNoneMatch` | `string\|null` | Header `If-None-Match` (ETag del cliente). |
| `device` | `TDevice` | Dispositivo detectado (lazy, cacheado). |
| `https` | `boolean` | `true` si la conexión es TLS. |
| `start` | `Date` | Marca de tiempo de inicio. |

#### Helpers estáticos

```ts
// Respuesta de éxito estandarizada
Conexion.buildRespuesta({ expiracion, data })  // → IRespuestaOK<T>

// Respuesta de error estandarizada
Conexion.buildError({ code, message })          // → IRespuestaKO
```

#### Ciclo de vida de la conexión

```
iniciando → iniciado → preparando → transfiriendo → terminado
```

El servidor llama a `conexion.iniciado()` tras leer la petición completa.
El router llama a `conexion.preparando()` al hacer match de ruta.
`transfiriendo()` y `terminado()` los llama `Respuesta` internamente al enviar.

---

## Router

**Entrada:** `@mr/core-network/server/http/router`

```ts
import {route} from "@mr/core-network/server/http/router";
import type {IErrorHandler, IShutdownHandler} from "@mr/core-network/server/http/router";
```

### `route(handlers, conexion)`

Despacha una conexión a través de la tabla de rutas:
1. Cede el event loop (`PromiseDelayed`) para no bloquear en ráfagas concurrentes.
2. Evalúa `handlers.check(conexion)`. Si ningún grupo hace match, delega al handler de error.
3. Cualquier excepción no controlada también se delega al handler de error.

### `IErrorHandler`

```ts
interface IErrorHandler {
    handleError(conexion: Respuesta, status: number, mensaje: string, extra?: unknown): Promise<number>;
}
```

### `IShutdownHandler`

```ts
interface IShutdownHandler {
    handleShutdown(conexion: Respuesta): Promise<number>;
}
```

---

## Routes

**Entrada:** `@mr/core-network/server/http/routes`

```ts
import {Routes} from "@mr/core-network/server/http/routes";
```

Tabla de enrutamiento: lista ordenada de `RouteGroup` más un `RouteGroupError` de fallback.

```ts
const routes = new Routes(
    [grupoA, grupoB, grupoC],  // evaluados en orden
    handlerError,               // invocado si ninguno hace match
);
```

| Método | Descripción |
|--------|-------------|
| `check(conexion)` | Evalúa los grupos en orden. Devuelve `true` si alguno procesa la petición. |
| `getDocumentables()` | Lista de rutas documentables, ordenada alfabéticamente por `resumen`. |

---

## RouteGroup

**Entrada:** `@mr/core-network/server/http/routes/group`

```ts
import {RouteGroup, RouteGroupError} from "@mr/core-network/server/http/routes/group";
import type {IRouteGroupParams, IConfigError} from "@mr/core-network/server/http/routes/group";
```

### Creación de un grupo

Extender `RouteGroup<T>` pasando como parámetro de tipo la configuración del servicio,
que debe extender `Configuracion` de `services-comun`:

```ts
import {Configuracion} from "services-comun/modules/utiles/config";
import {RouteGroup} from "@mr/core-network/server/http/routes/group";
import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";

// La configuración del servicio extiende Configuracion de services-comun
class MiConfig extends Configuracion { /* … */ }

class MiGrupo extends RouteGroup<MiConfig> {
    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/api/usuarios/", resumen: "/api/usuarios/"},
                ],
                handler: async (conexion) => {
                    return this.sendRespuesta(conexion, {
                        data: await obtenerUsuarios(),
                        expiracion: new Date(Date.now() + 60_000),
                    });
                },
            },
        ];
    }
}
```

La instancia de configuración queda accesible en `this.configuracion` con el tipo `T`
concreto, sin necesidad de cast.

### Integración WebSocket

Si el grupo maneja también peticiones WebSocket, sobreescribir `getWSHandlers()`.
**Cuando algún `RouteGroup` devuelve handlers no vacíos, el servidor WebSocket se inicia automáticamente.**

```ts
import type {IWSHandler} from "@mr/core-network/server/websocket/handler";

class MiGrupo extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { /* … */ }

    public override getWSHandlers(): IWSHandler[] {
        return [miWSHandler];
    }
}
```

Los `IWSHandler` devueltos se registran en el servidor WebSocket singleton a través de
`createWSServer()` / `addHandlers()`. Consulta
[`server/websocket/README.md`](../websocket/README.md) para la documentación del protocolo
y la implementación de handlers WebSocket.

### Helpers de respuesta (`protected`)

| Método | Descripción |
|--------|-------------|
| `sendRespuesta(conexion, {expiracion?, etag?, data?})` | Envía `IRespuestaOK<T>`. Sin `expiracion` aplica `no-cache`. Si `etag` coincide con el cliente devuelve 304. |
| `sendError(conexion, data?, {cache?, status?})` | Envía `IRespuestaKO`. Sin `cache` limpia ETag, Last-Modified y Vary. |

### `RouteGroupError`

Extiende `RouteGroup` e implementa `IErrorHandler`.
Usada como handler de fallback en `new Routes([…], handlerError)`.

```ts
class MiErrorHandler extends RouteGroupError {
    protected getHandlers(): IRouteGroup[] {
        return [{
            expresiones: [{metodos: ["ALL"], comodin: true, resumen: "/{url}", checkQuery: false}],
            handler: async (conexion) => conexion.error(404, "Not found"),
        }];
    }

    public async handleError(conexion, status, mensaje, extra?): Promise<number> {
        return conexion.setStatus(status).sendRespuesta({ok: false, info: {message: mensaje}});
    }
}
```

---

## RouteGroupBlock

**Entrada:** `@mr/core-network/server/http/routes/group/block`

Unidad mínima de enrutamiento. Se construye automáticamente por `RouteGroup`.

### `IRouteGroup`

```ts
interface IRouteGroup {
    expresiones?: IExpresion[];        // matchers de URL
    handler?: THandler;                // (conexion, grupos) => Promise<number>
    stop?: boolean;                    // detiene la cadena de grupos tras el match
    redireccion?: Dominio;             // redirección de subdominio si no está habilitado
    updater?: TUpdater;                // recarga dinámica de expresiones
    cache?: Partial<IRouteGroupCache>; // configuración de caché HTTP
    documentable?: boolean;            // visible en /admin/doc/ (defecto true)
}
```

### Updater dinámico

Permite que las expresiones de un bloque se recarguen periódicamente (p. ej. desde BD):

```ts
{
    updater: {
        interval: 60_000,  // recargar cada minuto (0 = solo al arrancar)
        exec: async (bloque) => {
            const rutas = await cargarRutasDesdeBD();
            return rutas.map(r => ({exact: r.path, resumen: r.name, metodos: ["GET"]}));
        },
    },
}
```

El bloque no acepta tráfico hasta que la primera carga complete (`ok = true`).
Si la carga falla, reintenta tras 1 segundo.

---

## Checkers

**Entrada:** `@mr/core-network/server/http/checkers`

Las expresiones de una ruta se configuran mediante la interfaz `IExpresion`:

```ts
import type {IExpresion} from "@mr/core-network/server/http/checkers";
```

### `IExpresion`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `metodos` | `TMetodo[]` | Métodos HTTP aceptados. `["ALL"]` o vacío = todos. `HEAD` y `OPTIONS` se añaden automáticamente. |
| `dominios` | `string[]` | Dominios aceptados. Vacío = todos. |
| `exact` | `string` | URL exacta. |
| `prefix` | `string` | Prefijo de URL. El resto del path se pasa al handler como primer grupo de captura. |
| `regex` | `RegExp` | Expresión regular. Los grupos de captura (1…n) se pasan al handler. |
| `comodin` | `boolean` | Acepta cualquier URL si `true`. |
| `resumen` | `string` | Identificador de la ruta (logs y documentación). **Obligatorio.** |
| `query` | `Record<string, IQuery>` | Validadores de parámetros de query string. |
| `checkQuery` | `boolean` | Activar validación de query (por defecto `true` si `query` está definido). |
| `lang` | `Partial<IExpresionLang>` | Restricciones de idioma (`include`, `exclude`, `redir`). |
| `log` | `boolean` | Logging de acceso. Por defecto `true`. |
| `internal` | `boolean` | Ruta de uso interno. |
| `deprecated` | `boolean` | Ruta obsoleta. |
| `post` / `response` / `headers` | `CustomSpecification` | Esquema para documentación y validación. |

### Matchers disponibles

| Clase | Uso | Grupos devueltos |
|-------|-----|-----------------|
| `Exact` | Coincidencia exacta de URL. | `[]` (ninguno) |
| `Prefix` | URL que comienza con el prefijo. | `[restoDelPath]` |
| `Regex` | URL evaluada contra expresión regular. | `[grupo1, grupo2, …]` |
| `Comodin` | Acepta cualquier URL. | `[urlCompleta]` |

Los grupos de captura se pasan como segundo argumento al handler:

```ts
handler: async (conexion, [id]) => {
    // para prefix "/usuario/" + URL "/usuario/42" → id = "42"
    return this.sendRespuesta(conexion, {data: await getUsuario(id)});
},
```

### Flujo de evaluación de `check()`

1. Método HTTP y dominio (variante optimizada generada en el constructor).
2. Matching de URL (`checkEjecutar`).
3. Restricciones de idioma (`lang.include` / `lang.exclude`).
4. Validación de query params (si `checkQuery = true`).

---

## Query checkers

**Entrada:** `@mr/core-network/server/http/checkers/query`

```ts
import type {IQuery} from "@mr/core-network/server/http/checkers/query";
```

Se usan como valores del mapa `IExpresion.query`:

```ts
{
    exact: "/buscar/",
    resumen: "/buscar/",
    query: {
        q:    {cualquiera: 1, description: "Texto de búsqueda"},
        lang: {options: ["es", "en", "fr"], opcional: true},
        page: {regex: /^\d+$/, opcional: true},
        src:  {prefix: "cat-", opcional: true},
    },
}
```

### `IQuery`

| Campo | Tipo | Validación |
|-------|------|------------|
| `exact` | `string` | El valor debe ser exactamente esta cadena. |
| `prefix` | `string` | El valor debe comenzar con este prefijo. |
| `options` | `string[]` | El valor debe pertenecer a este conjunto. |
| `regex` | `RegExp` | El valor debe coincidir con la expresión regular. |
| `cualquiera` | `number` | El valor debe tener al menos esta longitud en caracteres. |
| `opcional` | `boolean` | El parámetro puede estar ausente. Por defecto `false`. |
| `description` | `string` | Descripción del parámetro para documentación. |

Si el parámetro aparece varias veces en la URL, **todos** los valores deben superar la validación.

---

## Errores HTTP

**Entrada:** `@mr/core-network/server/http/error`

```ts
import {HttpError301, HttpError404, HttpError410, HttpError500} from "@mr/core-network/server/http/error";
```

| Clase | Código | Factory |
|-------|--------|---------|
| `HttpError` | — | Abstracta; base de todos los errores. |
| `HttpError301` | 301 | `HttpError301.build(location)` |
| `HttpError404` | 404 | `HttpError404.build(message, extra?)` |
| `HttpError410` | 410 | `HttpError410.build(message, extra?)` |
| `HttpError500` | 500 | `HttpError500.build(message, extra?)` |

```ts
throw HttpError404.build("Recurso no encontrado");
throw HttpError301.build("https://www.meteored.com/nueva-url");
throw HttpError500.build("Error interno", { stack: err.stack });
```

Todas exponen `sendRespuesta(conexion)` para enviar la respuesta adecuada al cliente.

---

## i18n

### Idiomas soportados

Los tipos y utilidades de idiomas (`IdiomaCorto`, `IdiomaLargo`, `Idioma`, `soportados`,
`soportado()`, `corto()`) se han extraído al paquete compartido `@mr/core-i18n`:

```ts
import {soportados, soportado, corto} from "@mr/core-i18n/langs";
import type {Idioma, IdiomaCorto, IdiomaLargo} from "@mr/core-i18n/langs";
```

Consulta la documentación completa en [`@mr/core/i18n/README.md`](../../../i18n/README.md).

### `Idioma` (detección por path)

**Entrada:** `@mr/core-network/server/http/i18n`

```ts
import {Idioma} from "@mr/core-network/server/http/i18n";
import type {IIdiomas} from "@mr/core-network/server/http/i18n";
```

Inicializar **una sola vez** al arrancar:

```ts
Idioma.inicializar({
    idiomas: ["es", "en", "fr", "de"],
    defecto: "en",
    enabled: true,
});
```

| Método | Descripción |
|--------|-------------|
| `Idioma.build(path)` | Detecta el idioma del path y devuelve una instancia con el path normalizado. |
| `idioma.generar(path, idioma?)` | Genera el path con prefijo de idioma si es distinto del defecto. |

#### Propiedades de instancia

| Propiedad | Descripción |
|-----------|-------------|
| `idioma` | Idioma detectado (p. ej. `"es"`). |
| `path` | Path sin prefijo de idioma (p. ej. `/inicio`). |
| `idioma_corto` | Código corto del idioma detectado. |
| `defecto_corto` | Código corto del idioma por defecto. |
| `defecto` | Idioma por defecto del servicio. |
| `idiomas` | Lista de idiomas soportados. |

---

## Schema

**Entrada:** `@mr/core-network/server/http/schema/spec`

```ts
import {buildSpecification} from "@mr/core-network/server/http/schema/spec";
import type {CustomSpecification, FieldDefinition} from "@mr/core-network/server/http/schema/spec";
```

Define la estructura de un cuerpo de petición/respuesta o conjunto de headers:

```ts
const schema = buildSpecification({
    name:  {type: "string",  required: true,  description: "Nombre del usuario"},
    age:   {type: "number",  required: false, description: "Edad"},
    admin: {type: "boolean", required: true,  description: "Es administrador"},
    tags:  {type: "array",   required: false, description: "Etiquetas",
            items: {type: "string", required: true, description: "Etiqueta"}},
    addr:  {type: "object",  required: false, description: "Dirección",
            properties: {
                city: {type: "string", required: true, description: "Ciudad"},
            }},
});
```

`buildSpecification` preserva los tipos literales (`as const`) para que `SchemedType`
pueda inferir el tipo TypeScript exacto del esquema.

---

## Schema → tipo TS

**Entrada:** `@mr/core-network/server/http/schema/spec-to-type`

```ts
import type {SchemedType} from "@mr/core-network/server/http/schema/spec-to-type";
```

Deriva el tipo TypeScript de un esquema creado con `buildSpecification`:

```ts
const schema = buildSpecification({
    name:  {type: "string",  required: true,  description: "Nombre"},
    email: {type: "string",  required: false, description: "Email"},
});

type TBody = SchemedType<typeof schema>;
// → { name: string; email?: string }
```

Los campos con `required: true` son obligatorios; los de `required: false` son opcionales (`?`).
Los tipos `array` y `object` se resuelven recursivamente.

---

## Validación backend

**Entrada:** `@mr/core-network/server/http/schema/validation/backend`

```ts
import {validate} from "@mr/core-network/server/http/schema/validation/backend";
```

Decorador de método que valida el body de una petición `POST` antes de invocar al handler.
Si la validación falla responde automáticamente con `400 Bad Request` y registra los errores en el log.

```ts
const schema = buildSpecification({
    name: {type: "string", required: true,  description: "Nombre"},
    age:  {type: "number", required: true,  description: "Edad"},
});

class MiHandler extends RouteGroup {
    @validate(schema)
    async handle(conexion: Conexion): Promise<number> {
        // el body ya está validado aquí
        const body = conexion.post as SchemedType<typeof schema>;
        return this.sendRespuesta(conexion, {data: body});
    }
}
```

> Para peticiones `multipart/form-data`, los campos `number` pueden llegar como `string`
> y se aceptan si el valor es convertible a número.

---

## `ConfiguracionNet`

**Entrada:** `@mr/core-network/server/http/config/config`

```ts
import {ConfiguracionNet} from "@mr/core-network/server/http/config/config";
import type {IConfiguracionNet} from "@mr/core-network/server/http/config/config";
```

Extiende `Configuracion` (de `services-comun`) añadiendo la propiedad `net: Net`.
Si `defecto.net` es `undefined`, se extrae automáticamente de `services.configuracion(this.pod.servicio)`.

```ts
interface IMyConfig extends IConfiguracionNet {
    redis: string;
}

class MyConfig extends ConfiguracionNet<IMyConfig> {
    public static build(services?: Service): MyConfig {
        return new this(
            {net: undefined, redis: "localhost"},
            {},
            services,
        );
    }
}
```

---

## `Service`

**Entrada:** `@mr/core-network/server/http/service`

```ts
import {Service} from "@mr/core-network/server/http/service";
```

Registro central de servicios. Calcula determinísticamente los puertos HTTP (base 8100) y
HTTPS (base 4433) de cada servicio mediante el hash MD5 de `endpoint.namespace.svc.cluster.local[/prefix]`.

```ts
export const enum EServicio { API = 1, CACHE = 2 }

const MAPA = new Map([
    [EServicio.API,   {endpoint: "api-service",   tags: ["api"]}],
    [EServicio.CACHE, {endpoint: "cache-service",  tags: ["cache"]}],
]);

const services = new Service(MAPA, {
    prefix:  "mi-proyecto",
    builder: id => EServicio[id],   // habilita .configuracion("API")
});

const apiNet    = services.configuracion(EServicio.API);  // por ID → INet
const apiNet2   = services.configuracion("API");           // por nombre
const apiClient = services.servicio(EServicio.API);        // → ConfigService
```

Soporta **alias**: un servicio puede heredar los puertos de otro ya registrado.
Los ciclos de alias se detectan y lanzan un error en tiempo de ejecución.

---

## TDevice

**Entrada:** `@mr/core-network/server/http/config/device`

```ts
import {TDevice} from "@mr/core-network/server/http/config/device";
```

| Valor | Descripción |
|-------|-------------|
| `TDevice.unknown` | Dispositivo no identificado. |
| `TDevice.desktop` | Navegador de escritorio. |
| `TDevice.mobile` | Navegador móvil (smartphone). |
| `TDevice.tablet` | Navegador de tablet. |

---

## Dominio

**Entrada:** `@mr/core-network/server/http/config/dominio`

```ts
import {Dominio} from "@mr/core-network/server/http/config/dominio";
import type {IDominioConfig} from "@mr/core-network/server/http/config/dominio";
```

### Comportamiento por entorno

| Entorno | Prefijo en host |
|---------|----------------|
| `DESARROLLO` | `local-` / `local.` |
| `TEST` | `test-` / `test.` |
| Producción | *(sin prefijo)* |

### Subdominios automáticos

- El subdominio base (`""`) y `"www"` siempre se registran.
- Los del listado no incluidos en `habilitados` ni en `redirigidos` se redirigen a `"www"`.
- Para comprobar pertenencia en `habilitados` se usa `indexOf(...)` en lugar de
  `includes(...)`, manteniendo compatibilidad con navegadores antiguos sin polyfill.

### Métodos públicos

| Método | Descripción |
|--------|-------------|
| `get(dominio)` | URL absoluta del subdominio. Devuelve `defecto` si no existe. |
| `getRedireccion(dominio)` | Subdominio destino de la redirección, o `undefined`. |
| `host(dominio)` | Host sin esquema del subdominio. |
| `search(url)` | Nombre del subdominio cuya URL coincide. Devuelve `"www"` si no hay coincidencia. |
| `searchHost(host)` | Nombre del subdominio cuyo host coincide. Devuelve `"www"` si no hay coincidencia. |

---

## Net

**Entrada:** `@mr/core-network/server/http/config/net`

```ts
import {Net} from "@mr/core-network/server/http/config/net";
import type {INet, INetService} from "@mr/core-network/server/http/config/net";
```

### `Net.buildDefault(cfg)`

| Entorno | Endpoints generados |
|---------|---------------------|
| `PRODUCCION` | DNS Kubernetes; puerto HTTP de `process.env.PORT` (defecto 8080) |
| Desarrollo con `cfg.desarrollo` | URL proporcionada para HTTP y HTTPS |
| Desarrollo sin `cfg.desarrollo` | `localhost` con `cfg.http` / `cfg.https` |

### Constructor `new Net(defecto, user)`

Fusiona `defecto` con las sobreescrituras parciales de `user`. Todos los campos no presentes en `user` toman el valor de `defecto`.

---

## Handlers predefinidos

El directorio `handlers/` contiene grupos listos para usar y ejemplos de referencia.

```ts
import adminHandler   from "@mr/core-network/server/http/handlers/admin";
import errorHandler   from "@mr/core-network/server/http/handlers/error";
import faviconHandler from "@mr/core-network/server/http/handlers/favicon";

const handlerError = errorHandler(config);
const routes = new Routes(
    [
        adminHandler(config, engine),
        faviconHandler(config),
        miGrupo,
    ],
    handlerError,
);
```

Cada factory devuelve un singleton: llamadas múltiples retornan la misma instancia.

### `adminHandler(config, engine)` — rutas de administración

Ninguna ruta de este grupo se incluye en la documentación pública.

| Ruta | Descripción |
|------|-------------|
| `GET /admin/started/` | ¿Ha arrancado el servicio? (`engine.started()`) |
| `GET /admin/ready/` | ¿Está listo para recibir tráfico? (`engine.ready()`) |
| `GET /admin/live/` | Liveness probe. (`engine.okAll()`) |
| `GET /admin/check/` | Alias de `/admin/live/`. |
| `GET /admin/doc/` | Lista de rutas documentables del servicio en JSON. |

### `errorHandler(config)` — handler de error por defecto

Implementa `IErrorHandler`. Responde con `404` a cualquier URL no reconocida y
gestiona todos los errores HTTP propagados devolviendo una respuesta JSON estándar:

```json
{"ok": false, "expiracion": 1234567890, "info": {"message": "Not found", "extra": null}}
```

### `faviconHandler(config)` — favicon

- `GET /favicon.ico` — sirve `assets/favicon.ico` con caché de 1 mes.
  Responde con `404 no-cache` si el fichero no existe.

---

## Changelog

Consulta [`CHANGELOG.md`](../../CHANGELOG.md) para el historial de cambios del paquete.

