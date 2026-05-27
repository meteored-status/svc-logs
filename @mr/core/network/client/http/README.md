# `@mr/core-network/client/http`

Tipos de protocolo, manejo de errores, parsers de respuesta y clases de petición HTTP para la Fetch API.

---

## Contenido

| Fichero / Directorio | Entrada | Descripción |
|----------------------|---------|-------------|
| [`interface.ts`](#tipos-de-respuesta) | `@mr/core-network/client/http/interface` | `ErrorCode`, `IErrorInfo`, `IRespuesta<T>` — tipos base del protocolo HTTP |
| [`error.ts`](#requesterror) | `@mr/core-network/client/http/error` | `RequestError` — error tipado de petición HTTP |
| [`respuesta.ts`](#respuesta) | `@mr/core-network/client/http/respuesta` | `Respuesta<T>` — respuesta HTTP con metadatos de caché |
| [`parser/`](#parsers) | `@mr/core-network/client/http/parser/…` | Funciones de parseo de `Response` → `Respuesta<T>` |
| [`peticion/`](#peticiones) | `@mr/core-network/client/http/peticion/…` | Clases de petición HTTP (GET, POST, PUT, PATCH, DELETE, HEAD) |

---

## Tipos de respuesta

**Entrada:** `@mr/core-network/client/http/interface`

```ts
import {ErrorCode} from "@mr/core-network/client/http/interface";
import type {IErrorInfo, IOK, IRespuesta, IRespuestaKO, IRespuestaOK} from "@mr/core-network/client/http/interface";
```

### `ErrorCode`

`const enum` que clasifica el motivo de fallo de una petición HTTP.

| Valor | Nº | Descripción |
|-------|----|-------------|
| `NETWORK` | 1 | Error de red o conexión. |
| `TIMEOUT` | 2 | La petición superó el tiempo máximo de espera. |
| `AUTHENTICATION` | 3 | Credenciales inválidas o ausentes (401/403). |
| `RESPONSE` | 4 | La respuesta no pudo ser procesada (formato inesperado). |
| `APPLICATION` | 5 | Error de lógica de negocio devuelto por el servidor. |
| `NO_DATA_TEMPORARY` | 6 | Recurso no disponible temporalmente; puede reintentarse. |
| `NO_DATA_PERMANENT` | 7 | Recurso inexistente o eliminado; no debe reintentarse. |
| `NO_DATA` | 8 | Sin datos, sin indicación de temporalidad. |

### `IErrorInfo`

Información de error adjunta a una respuesta fallida.

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `code` | `ErrorCode` | ✅ | Clasificación del fallo. |
| `message` | `string` | ✅ | Descripción legible del error. |
| `extra` | `unknown` | — | Información adicional de contexto adjuntada por el emisor. |

### `IOK<T>`

Resultado de una operación exitosa con metadatos de caché.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `expiracion` | `Date` | Fecha a partir de la cual el dato se considera expirado. |
| `etag` | `string` | Identificador de versión del recurso para validación condicional. |
| `data` | `T` | Dato obtenido. |

### `IRespuesta<T>` — unión discriminada

`IRespuesta<T> = IRespuestaOK<T> | IRespuestaKO<T>`

El campo `ok` actúa como discriminante:

```ts
if (resp.ok) {
    // resp es IRespuestaOK<T> → resp.data disponible
} else {
    // resp es IRespuestaKO<T> → resp.info disponible
}
```

#### `IRespuestaOK<T>`

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `ok` | `true` | ✅ | Discriminante. |
| `expiracion` | `number` | ✅ | Timestamp Unix (ms) de expiración del dato. |
| `data` | `T` | ✅ | Dato devuelto por el servidor. |
| `info` | `IErrorInfo` | — | Advertencias o contexto adicional en respuestas exitosas. |

#### `IRespuestaKO<T>`

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `ok` | `false` | ✅ | Discriminante. |
| `expiracion` | `number` | — | Timestamp Unix (ms) de expiración. Ausente si el servidor no lo indica. |
| `data` | `T` | — | Dato parcial opcional que puede acompañar al error. |
| `info` | `IErrorInfo` | ✅ | Detalle del error devuelto por el servidor. |

---

## `RequestError`

**Entrada:** `@mr/core-network/client/http/error`

Error lanzado cuando una petición HTTP no se completa correctamente. Extiende `CustomError`
añadiendo contexto de red: código de estado HTTP, URL solicitada y cabeceras de respuesta.

```ts
import {RequestError} from "@mr/core-network/client/http/error";
import type {IRequestError} from "@mr/core-network/client/http/error";
```

### `IRequestError`

Datos necesarios para construir un `RequestError`. Extiende `IErrorInfo`.

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `status` | `number` | ✅ | Código de estado HTTP de la respuesta que originó el error. |
| `url` | `string` | ✅ | URL completa de la petición fallida. |
| `headers` | `Headers` | ✅ | Cabeceras de la respuesta recibida. |
| `code` | `ErrorCode` | ✅ | *(heredado)* Clasificación del fallo. |
| `message` | `string` | ✅ | *(heredado)* Descripción legible del error. |
| `extra` | `unknown` | — | *(heredado)* Información adicional de contexto. |

### Propiedades de `RequestError`

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `status` | `number` | Código de estado HTTP. |
| `url` | `string` | URL de la petición fallida. |
| `headers` | `Headers` | Cabeceras de la respuesta. |
| `code` | `ErrorCode` | Clasificación del fallo. |
| `extra` | `unknown` | Información adicional de contexto. |

### Ejemplo

```ts
import {RequestError} from "@mr/core-network/client/http/error";
import {ErrorCode} from "@mr/core-network/client/http/interface";

throw new RequestError({
    status: 503,
    url: "https://api.example.com/datos",
    headers: response.headers,
    code: ErrorCode.NETWORK,
    message: "Servicio no disponible",
});
```

---

## `Respuesta<T>`

**Entrada:** `@mr/core-network/client/http/respuesta`

Encapsula la respuesta HTTP de una petición exitosa junto con sus metadatos de caché.
Extrae automáticamente la cabecera `Expires` para determinar si el resultado es cacheable.

```ts
import {Respuesta} from "@mr/core-network/client/http/respuesta";
```

### Propiedades

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `status` | `number` | Código de estado HTTP de la respuesta. |
| `headers` | `Headers` | Cabeceras de la respuesta. |
| `data` | `T` | Cuerpo de la respuesta ya parseado con el tipo `T`. |
| `expires` | `Date` | Fecha de expiración extraída de `Expires`, o `expiracion` / fecha actual si no estaba presente. |
| `cacheable` | `boolean` | `true` si la respuesta incluía la cabecera `Expires`; `false` en caso contrario. |

### Constructor

| Parámetro | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `response` | `Response` | ✅ | Respuesta HTTP de la Fetch API. |
| `data` | `T` | ✅ | Cuerpo ya deserializado y tipado. |
| `expiracion` | `Date` | — | Fecha de expiración de reserva si el servidor no envía `Expires`. Por defecto, fecha actual. |

---

## Parsers

**Directorio:** `@mr/core-network/client/http/parser/`

Funciones que transforman una `Response` de la Fetch API en `Respuesta<T>`. Se pasan como argumento `parser` a las clases de petición.

```ts
import type {Parser} from "@mr/core-network/client/http/parser";
```

`Parser<T>` es el tipo `(response: Response) => Promise<Respuesta<T>>`.

| Entrada | Tipo de respuesta | Descripción |
|---------|-------------------|-------------|
| `@mr/core-network/client/http/parser/json` | `Respuesta<T>` | Deserializa el cuerpo con `response.json()`. |
| `@mr/core-network/client/http/parser/respuesta` | `Respuesta<T>` | Deserializa como `IRespuesta<T>` y rechaza con `RequestError` si `ok === false` o la estructura es inválida. |
| `@mr/core-network/client/http/parser/text` | `Respuesta<string>` | Lee el cuerpo con `response.text()`. |
| `@mr/core-network/client/http/parser/buffer` | `Respuesta<Buffer>` | Lee el cuerpo como `ArrayBuffer` y lo convierte a `Buffer` de Node.js. |
| `@mr/core-network/client/http/parser/array-buffer` | `Respuesta<ArrayBuffer>` | Lee el cuerpo con `response.arrayBuffer()`. |
| `@mr/core-network/client/http/parser/void` | `Respuesta<void>` | Descarta el cuerpo. Usado por `PeticionHEAD` y `PeticionPUT`. |

### Ejemplo

```ts
import {PeticionGET} from "@mr/core-network/client/http/peticion/get";
import parser from "@mr/core-network/client/http/parser/json";

const respuesta = await PeticionGET.run<IMyData>("https://api.example.com/data", parser);
console.log(respuesta.data);
```

---

## Peticiones

**Directorio:** `@mr/core-network/client/http/peticion/`

Jerarquía de clases para ejecutar peticiones HTTP tipadas. Todas se instancian exclusivamente a través del método estático `run()`.

```
Peticion (abstracta)
└── PeticionGET
└── PeticionHEAD
└── PeticionDELETE
└── PeticionData<K>
    ├── PeticionPOST<K>
    ├── PeticionPUT<K>
    └── PeticionPATCH<K>
```

### `IRequestConfig`

Configuración común a todas las peticiones.

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `method` | `RequestMethod` | ✅ | Método HTTP. |
| `auth` | `string` | — | Valor del encabezado `Authorization`. |
| `contentType` | `string` | — | `Content-Type` del cuerpo. Por defecto `application/json` en peticiones con cuerpo. |
| `dominioAlternativo` | `string` | — | Dominio de fallback para peticiones fallidas en `localhost` (solo desarrollo). |
| `headers` | `Headers` | — | Encabezados personalizados iniciales. |
| `traceparent` | `string` | — | Cabecera W3C Trace Context para propagación de trazabilidad Datadog. |

### Métodos `run()` por clase

| Clase | Entrada | Firma del `run()` estático |
|-------|---------|---------------------------|
| `PeticionGET` | `…/peticion/get` | `run<T>(url, parser, cfg?)` |
| `PeticionHEAD` | `…/peticion/head` | `run(url, cfg?)` |
| `PeticionDELETE` | `…/peticion/delete` | `run<T>(url, parser, cfg?)` |
| `PeticionPOST<K>` | `…/peticion/post` | `run<T,K>(url, data, parser, cfg?)` |
| `PeticionPUT<K>` | `…/peticion/put` | `run<K>(url, data, cfg?)` |
| `PeticionPATCH<K>` | `…/peticion/patch` | `run<T,K>(url, data, parser, cfg?)` |

### Serialización del cuerpo (`PeticionData<K>`)

| `Content-Type` | Serialización |
|----------------|---------------|
| `application/json` *(defecto)* | `JSON.stringify(data)` |
| `multipart/form-data` | `data` como `FormData` (lanza `TypeError` si no lo es) |
| `text/plain` | `String(data)` |
| Cualquier otro | Lanza `TypeError` |

### Ejemplo

```ts
import {PeticionPOST} from "@mr/core-network/client/http/peticion/post";
import parser from "@mr/core-network/client/http/parser/respuesta";

const respuesta = await PeticionPOST.run<IOut, IIn>(
    "https://api.example.com/endpoint",
    { campo: "valor" },
    parser,
    { auth: "Bearer token123" },
);
```

