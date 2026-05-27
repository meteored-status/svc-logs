# `@mr/core-network/client/websocket`

Cliente WebSocket con pool de conexiones, reconexión automática, backoff exponencial, circuit breaker, timeouts configurables y trazabilidad Datadog.

Para la documentación completa del protocolo, ejemplos del servidor y flujos de comunicación consulta [`websocket/README.md`](../../websocket/README.md).

---

## Contenido

| Fichero | Descripción |
|---------|-------------|
| [`index.ts`](#wspool) | `WSPool` — pool de conexiones WebSocket del lado cliente |
| [`result.ts`](#result) | `Result` — encapsula el generator; expone `next()`, `consume()` y `pipe()` |
| [`error.ts`](#wsconnectionerror) | `WSConnectionError` — señal interna del circuit breaker |

Las interfaces del protocolo se encuentran en [`metadata/websocket/README.md`](../../metadata/websocket/README.md).

---

## `WSPool`

**Entrada:** `@mr/core-network/client/websocket`

Pool de conexiones WebSocket lado cliente. Garantiza una única instancia por endpoint (singleton por URL + configuración).

```ts
import {WSPool} from "@mr/core-network/client/websocket";

// Una sola instancia por URL (reconnect activo por defecto)
const pool = WSPool.get({ socket: "ws://servicio:8080" });

// Con número mínimo de conexiones personalizado
const pool = WSPool.get({
    socket: "ws://servicio:8080",
    minConnections: 25,
});

// Con timeouts personalizados
const pool = WSPool.get({
    socket: "ws://servicio:8080",
    requestTimeoutMs: 10_000,    // por defecto 30 s
    heartbeatTimeoutMs: 30_000,  // por defecto 45 s
});
```

### Métodos

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `WSPool.get(config)` | `WSPool` | Devuelve (o crea) el pool para el endpoint dado. |
| `pool.get(method, params?, buffer?)` | `Promise<Result>` | Envía una petición y devuelve el `Result` para consumir el stream de respuestas. |
| `pool.head(method, params?)` | `Promise<void>` | Fire-and-forget: envía sin esperar respuesta. |
| `pool.getCircuitState()` | `CircuitState` | Estado actual del circuit breaker (`"closed"`, `"open"`, `"half-open"`). |
| `pool.destroy(code?, reason?)` | `void` | Cierra todas las conexiones y elimina el singleton. |

---

## `Result`

**Entrada:** `@mr/core-network/client/websocket/result`

Resultado de `pool.get()`. Encapsula el `AsyncGenerator<IStreamFrame>` y ofrece tres formas de consumo:

```ts
import {Result} from "@mr/core-network/client/websocket/result";
```

| Método | Descripción |
|--------|-------------|
| `result.next<T>()` | Consume el siguiente frame y devuelve `Promise<IResponse<T>>`. |
| `result.consume<T>(promise, deferred?)` | Consume una promesa del generator ya lanzada. Sin `Deferred` devuelve la promesa; con `Deferred` resuelve/rechaza el Deferred (sin fallback HTTP). |
| `result.pipe(d1, d2?, d3?)` | Consume N frames en paralelo resolviendo Deferreds independientemente. En error los Deferreds quedan pendientes para fallback HTTP. |
| `result.generator` | Generator raw para uso con `for await…of`. |

---

## Interfaces del protocolo

**Entrada:** `@mr/core-network/metadata/websocket/message`

```ts
import type {
    IMessageClient,
    IMessageServerOK,
    IMessageServerKO,
    IMetadata,
    IStreamFrame,
    MessageServer,
} from "@mr/core-network/metadata/websocket/message";
```

| Símbolo | Descripción |
|---------|-------------|
| `IMessageClient<T>` | Mensaje enviado por el cliente. `buffer: true` indica frame binario adjunto; `head: true` indica fire-and-forget. |
| `IMessageServerOK<T>` | Respuesta exitosa del servidor. `done: false` en frames intermedios de stream; `done: true` en el último. |
| `IMessageServerKO` | Respuesta de error del servidor. |
| `MessageServer<T>` | Unión discriminada `IMessageServerOK<T> \| IMessageServerKO`. |
| `IMetadata` | Metadatos opcionales de la respuesta (`expires`). |
| `IStreamFrame` | Par `{ message: MessageServer; buffer?: ArrayBuffer }` que el generator produce por cada respuesta. |

---

## `WSConnectionError`

**Entrada:** `@mr/core-network/client/websocket/error`

Error interno que el pool lanza cuando una conexión WebSocket falla a nivel de red (rechazo de conexión, reconexiones agotadas). Solo estos errores activan el circuit breaker; los timeouts de petición no lo hacen.

```ts
import {WSConnectionError} from "@mr/core-network/client/websocket/error";

// En un catch del llamador:
if (err instanceof WSConnectionError) {
    console.error("Fallo de red WebSocket:", err.message);
}
```

---

## Changelog

Consulta [`CHANGELOG.md`](../CHANGELOG.md) para el historial de cambios del módulo.

