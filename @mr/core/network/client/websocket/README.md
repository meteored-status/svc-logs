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

Con cabeceras en el handshake (p. ej. un token): `headers` se pasa al `new WebSocket(url, {headers})` del
`WebSocket` global de Node (undici) **solo si hay alguna**; en navegador el segundo argumento son los
`protocols` y lanzaría `SyntaxError`, así que ahí no se usan.

```ts
const pool = WSPool.get({
    socket: "https://status.meteored.com/status/external/heartbeat/",
    headers: {"x-mr-heartbeat": token},
});
```

Las cabeceras **no forman parte de la clave del singleton** (la ruta ya separa pools de servicios
distintos): si se pide un pool que ya existe con otras cabeceras, se conserva el existente y se emite un
`warning` (una vez por pool, sin los valores, que pueden ser credenciales). Un handshake rechazado (p. ej.
`401`) es un fallo de conexión como cualquier otro: `head()`/`get()` rechazan, cuenta para el circuit
breaker (a los 5 se abre y la sonda reintenta con backoff exponencial hasta 30 s) y el relleno de fondo
solo reintenta cada 60 s.

### Métodos

| Método | Devuelve | Descripción |
|--------|----------|-------------|
| `WSPool.get(config)` | `WSPool` | Devuelve (o crea) el pool para el endpoint dado. |
| `pool.get(method, params?, buffer?)` | `Promise<Result>` | Envía una petición y devuelve el `Result` para consumir el stream de respuestas. |
| `pool.head(method, params?)` | `Promise<void>` | Fire-and-forget: envía sin esperar respuesta. |
| `pool.getCircuitState()` | `CircuitState` | Estado actual del circuit breaker (`"closed"`, `"open"`, `"half-open"`). |
| `pool.vaciar({timeoutMs?})` | `Promise<void>` | Espera a que todas las conexiones abiertas tengan `bufferedAmount === 0` (lo enviado con `head()` ya salió del proceso) o a que venza `timeoutMs` (1000 por defecto). **Nunca rechaza.** Pensado para una despedida justo antes de salir. |
| `pool.destroy(code?, reason?)` | `void` | Cierra todas las conexiones y elimina el singleton. **No deja sockets abiertos**: cancela la reposición programada, un handshake que termine después se cierra al abrirse, el pool no abre más conexiones (ni bajo demanda: `get()`/`head()` rechazan) y el bucle de reconexión de un `get()` en curso lanza en vez de reintentar. |

### Reposición tras perder una conexión

Cuando se pierde una conexión (`Shutdown` del servidor, cierre, error o timeout de heartbeat) el pool la repone **en segundo plano
con un retraso aleatorio de 0 a `refillJitterMs`** (3000 ms por defecto; con 0 se repone en el acto, como antes). Es para
repartir las reconexiones cuando un servidor se apaga y todos sus clientes pierden la conexión a la vez.

```ts
const pool = WSPool.get({socket: "ws://servicio:8080", refillJitterMs: 5000});
```

- **Ninguna petición espera al jitter.** Si hace falta una conexión y no hay ninguna libre, `getConnection()` la abre al momento.
  Por eso un emisor que escribe a menudo (el heartbeat de pods, uno por segundo) apenas se reparte: reabre bajo demanda en su
  siguiente envío. El jitter reparte a los pools que están en reposo.
- **Un solo temporizador a la vez**, y al vencer se recalcula lo que falta: una conexión abierta bajo demanda entretanto cuenta, y
  no se abre otra. Las conexiones **con el handshake en vuelo también cuentan** (`pendingConnections`); antes, dos reposiciones
  seguidas o una reposición y una apertura bajo demanda abrían cada una la suya y el pool acababa con sockets de más.
- No afecta al llenado inicial del constructor, que sigue siendo inmediato, ni al relleno periódico de 60 s.
- No cambia el circuit breaker (las reposiciones en segundo plano no lo alimentan, ni antes ni ahora), el backoff de `stream()` ni
  el tratamiento de los streams en curso.
- No forma parte de la clave del singleton (como `headers`): se aplica la del primer `get()` de ese endpoint.

### Cuántas conexiones abre

`minConnections` (10 por defecto, mínimo 1) es cuántas se mantienen **calientes**, no un tope.
`getConnection()` hace `available.pop() ?? addConnection()`, así que el número real lo marca la
concurrencia: N peticiones lanzadas a la vez abren N conexiones, aunque sean `head()` — la conexión no
vuelve a `available` hasta que la promesa del envío resuelve, y en una ráfaga síncrona eso es siempre
después. Quien necesite una sola conexión tiene que encadenar sus envíos, no bajar `minConnections`.

En un `get()`, la conexión vuelve a `available` en cuanto llega el último frame (`done`, o un error del
servidor), **antes** de que el generator lo ceda. Así que `await (await pool.get(...)).next()` —leer un
frame y abandonar el `Result`— basta para que la conexión se reutilice; no hace falta agotar el
generator ni llamar a `return()`. Hasta el 2026-09-24 se devolvía en el `finally` del generator, que con
ese patrón no se ejecutaba nunca: cada petición dejaba su socket abierto y la siguiente abría otro.
Un stream que se abandona **antes** de su último frame sí retiene la conexión hasta que se cierre con
`result.generator.return()`.

### La URL del endpoint

`WSPool.get()` normaliza el `socket` antes de nada: `http`/`https` pasan a `ws`/`wss`, y si no lleva
puerto se le pone el del esquema (80 u 443).

**Puede llevar ruta, y a menudo tiene que llevarla.** Cuando varios servicios comparten dominio, la ruta
es lo único que mira el VirtualService de Istio para decidir a qué servicio va el upgrade; sin ella se lo
queda el servicio por defecto, así que el síntoma de omitirla no es un fallo de conexión sino que la
petición acaba en otro sitio.

```ts
// Dentro del clúster: por nombre de servicio, sin ruta.
WSPool.get({socket: "ws://status-external:8080"});

// Desde fuera: dominio compartido, y la ruta que enruta.
WSPool.get({socket: "https://status.meteored.com/status/external/"});
```

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
| `result.pipe(d1, d2?, d3?, d4?)` | Consume N frames en paralelo resolviendo Deferreds independientemente. En error los Deferreds quedan pendientes para fallback HTTP. |
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

