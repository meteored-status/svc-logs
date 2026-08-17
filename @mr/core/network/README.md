# `@mr/core-network`

Paquete de primitivas de red compartidas por todos los servicios del monorepo.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Raíz](#interfaz-iresponse) | `@mr/core-network` | Interfaz `IResponse<T>` — tipo base de todas las respuestas |
| [Route](./route/README.md) | `@mr/core-network/route` | `Route` — routing HTTP con URLs por idioma, parámetros y ejecución de handlers |
| [Metadata](./metadata/README.md) | `@mr/core-network/metadata/…` | Interfaces de protocolo compartidas (mensajes WebSocket) |
| [Server](./server/README.md) | `@mr/core-network/server/…` | Módulos de servidor: WebSocket y configuración HTTP |
| [Client](./client/README.md) | `@mr/core-network/client/…` | `WSPool` — cliente WebSocket; `factoryCache<T>()` — caché genérica; `randomUA()` — User-Agent aleatorio |

---

## Interfaz `IResponse<T>`

**Entrada:** `@mr/core-network` (`index.ts`)

Tipo base devuelto por todos los métodos de red del monorepo, tanto sobre WebSocket como sobre HTTP.

```ts
/**
 * @template T - Tipo del payload de negocio. Lo declara el consumidor en cada llamada.
 */
export interface IResponse<T> {
    data: T;
    expires?: number;
    buffer?: ArrayBuffer;
}
```

### Campos

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|:-----------:|-------------|
| `data` | `T` | ✅ | Payload de negocio. El consumidor declara el tipo genérico. |
| `expires` | `number` | — | Timestamp Unix (ms) a partir del cual la respuesta se considera expirada. Ausente si el servidor no indica TTL. |
| `buffer` | `ArrayBuffer` | — | Frame binario adjunto. Solo presente en respuestas WebSocket con `buffer: true`. |

### Uso

```ts
import type {IResponse} from "@mr/core-network";

// Respuesta simple
const resp: IResponse<{ nombre: string }> = {
    data: { nombre: "Madrid" },
    expires: Date.now() + 60_000,
};

// Con frame binario (WebSocket)
const bin: IResponse<{ id: number }> = {
    data: { id: 7 },
    buffer: new ArrayBuffer(1024),
};
```

---

## Route

Documentación completa en [`route/README.md`](./route/README.md).

Modela una sección de routing HTTP: URLs por idioma, parámetros de URL variables, validación de idioma y ejecución de handlers. Transferido desde `@mr/core-templates/seccion`.

```ts
import {Route, crearExactGET} from "@mr/core-network/route";
import type {IRoute, IRouteBuilderOptions, TRouteRunner, TParams} from "@mr/core-network/route";
```

---

## Server

Documentación completa en [`server/README.md`](./server/README.md).

Incluye:
- **`server/websocket/`** — servidor WebSocket singleton, handlers (`IWSHandler`), respuestas en streaming, frames binarios, shutdown graceful y trazabilidad Datadog.
- **`server/http/config/`** — tipos de configuración HTTP (`TDevice`).
- **`server/http/upgrade.ts`** — reenvío genérico de peticiones con cabecera `Upgrade:` HTTP/1.1 (WebSocket de aplicación, HMR de bundlers); ver [`server/http/README.md#upgrade`](./server/http/README.md#upgrade).

```ts
import createWSServer from "@mr/core-network/server/websocket";
import type {IWSHandler} from "@mr/core-network/server/websocket/handler";
import {TDevice} from "@mr/core-network/server/http/config/device";
```

---

## Client

Documentación completa en [`client/README.md`](./client/README.md).

Incluye:
- **`client/websocket/`** — cliente WebSocket con pool de conexiones, reconexión automática, backoff exponencial, circuit breaker, timeouts y trazabilidad Datadog (`WSPool`, `Result`).
- **`client/http/`** — tipos de respuesta (`IRespuesta<T>`, `ErrorCode`), `RequestError`, `Respuesta<T>`, parsers (`json`, `respuesta`, `text`, `buffer`, `array-buffer`, `void`) y clases de petición HTTP (`PeticionGET`, `PeticionPOST`, etc.).
- **`client/factory.ts`** — caché genérica de peticiones asíncronas con deduplicación y expiración automática (`factoryCache<T>`).
- **`client/ua.ts`** — generación de User-Agents aleatorios de una lista curada de navegadores modernos (`randomUA`).

```ts
import {WSPool} from "@mr/core-network/client/websocket";
import {PeticionGET} from "@mr/core-network/client/http/peticion/get";
import parser from "@mr/core-network/client/http/parser/respuesta";
import {factoryCache} from "@mr/core-network/client/factory";
import {randomUA} from "@mr/core-network/client/ua";
```

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.
