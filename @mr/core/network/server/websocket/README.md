# WebSocket — Servidor

Módulo que implementa el servidor WebSocket con soporte para **streaming**, **frames binarios**, **handlers tipados**, **rate limiting**, **backpressure automático**, **shutdown graceful** y **trazabilidad distribuida con Datadog**.

Para la documentación del cliente (`WSPool`, `Result`, circuit breaker, reconexión automática) consulta [`client/websocket/README.md`](../../client/websocket/README.md).

---

## Índice

1. [Estructura de ficheros](#estructura-de-ficheros)
2. [Protocolo de mensajes](#protocolo-de-mensajes)
   - [Mensaje del cliente → servidor](#mensaje-del-cliente--servidor)
   - [Respuesta exitosa](#respuesta-exitosa-servidor--cliente)
   - [Respuesta de error](#respuesta-de-error-servidor--cliente)
3. [Servidor (`server/websocket/`)](#servidor-serverwebsocket)
   - [Arranque](#arranque)
   - [Implementar un handler](#implementar-un-handler)
   - [Respuestas en streaming](#respuestas-en-streaming-servidor)
   - [Liveness y shutdown automático](#liveness-y-shutdown-automático)
4. [Trazabilidad con Datadog](#trazabilidad-con-datadog)
5. [Flujo completo de una petición](#flujo-completo-de-una-petición)
6. [Referencia rápida de interfaces](#referencia-rápida-de-interfaces)

---

## Estructura de ficheros

```
server/websocket/
├── escalonado.ts   # Funciones puras: ventana y retrasos del Shutdown del apagado, vida con jitter
├── handler.ts      # Interfaz IWSHandler y clase auxiliar WSHandler
└── index.ts        # Servidor WebSocket (singleton) + EWSControlMessage

client/websocket/   → ver client/websocket/README.md
├── error.ts        # WSConnectionError — señal interna del circuit breaker
├── index.ts        # Pool de conexiones WebSocket (lado cliente)
├── message.ts      # Interfaces del protocolo WebSocket
└── result.ts       # Clase Result que encapsula el generator de respuestas
```

---

## Protocolo de mensajes

Todos los mensajes son **JSON** (excepto los frames binarios opcionales). El campo `id` actúa como correlacionador entre petición y respuesta.

### Mensaje del cliente → servidor

```json
{
  "id":       "550e8400-e29b-41d4-a716–446655440000",
  "method":   "getNombre",
  "buffer":   false,
  "params":   { "locale": "es" },
  "_datadog": { "x-datadog-trace-id": "…", "x-datadog-parent-id": "…" }
}
```

| Campo       | Tipo      | Descripción |
|-------------|-----------|-------------|
| `id`        | `string`  | UUID generado por el cliente para correlacionar la respuesta. |
| `method`    | `string`  | Nombre de la acción que el servidor debe ejecutar. |
| `buffer`    | `boolean` | Si `true`, el cliente enviará un frame binario en el siguiente mensaje. |
| `head`      | `boolean?`| Si `true`, el cliente no espera respuesta (fire-and-forget). El servidor ejecuta el handler pero silencia `sendRespuesta`/`sendError`. |
| `params`    | `any?`    | Parámetros opcionales de la petición. |
| `_datadog`  | `object?` | Contexto de traza Datadog (TEXT_MAP) para propagación distribuida. |

### Respuesta exitosa (servidor → cliente)

```json
{
  "id":       "550e8400-e29b-41d4-a716–446655440000",
  "ok":       true,
  "buffer":   false,
  "done":     true,
  "metadata": { "expires": 1745000000 },
  "data":     { "nombre": "Madrid" }
}
```

| Campo      | Tipo       | Descripción |
|------------|------------|-------------|
| `ok`       | `true`     | Discriminante de respuesta exitosa. |
| `buffer`   | `boolean`  | Si `true`, llegará un frame binario tras este mensaje. |
| `done`     | `boolean`  | `false` en fragmentos intermedios de un stream; `true` en el último. |
| `metadata` | `object?`  | Metadatos opcionales (p. ej. `expires` para caché). |
| `data`     | `T`        | Payload de la respuesta. |

### Respuesta de error (servidor → cliente)

```json
{
  "id":   "550e8400-e29b-41d4-a716–446655440000",
  "ok":   false,
  "info": {
    "message": "No handler for method getNombre",
    "extra":   null
  }
}
```

---

## Servidor (`server/websocket/`)

### Arranque

El servidor se expone como una función que devuelve siempre la misma instancia (**singleton**). Se adjunta a un servidor HTTP de Node.js existente.

```ts
import http from "node:http";
import createWSServer from "@mr/core-network/server/websocket";
import { MiHandler } from "./handlers/mi-handler";

const httpServer = http.createServer(/* … */);

// Registrar handlers y arrancar
const ws = createWSServer(httpServer, [
    new MiHandler(),
]);

httpServer.listen(8080);
```

Si distintos módulos necesitan registrar sus propios handlers de forma independiente, pueden llamar a `createWSServer` o a `ws.addHandlers()` varias veces: los handlers se acumulan en el mismo servidor sin reemplazar los anteriores.

```ts
// módulo-a.ts
createWSServer(httpServer, [new HandlerA()]);

// módulo-b.ts — llama al mismo singleton y añade sus handlers
createWSServer(httpServer, [new HandlerB(), new HandlerC()]);
```

### Shutdown graceful

Para un apagado controlado (p. ej. al recibir SIGTERM en Kubernetes):

```ts
const ws = createWSServer(httpServer, handlers);

process.on("SIGTERM", async () => {
    await ws.shutdown();   // por defecto espera hasta 30 s
    process.exit(0);
});

// Con timeout personalizado:
await ws.shutdown(10_000); // máximo 10 s antes de forzar cierre
```

El método: (1) deja de aceptar nuevas conexiones; (2) envía `"Shutdown"` a los clientes activos (**repartido en el tiempo si son 50 o más**, ver más abajo); (3) espera a que cierren limpiamente; (4) fuerza el cierre de los que no respondan; (5) elimina el singleton.

#### Shutdown escalonado

Un cliente reconecta en cuanto recibe `"Shutdown"`. Si una réplica con cientos de clientes los avisa a todos a la vez, todos
llegan a la vez a las réplicas que quedan: medido en producción (status-external, 2026-11-18), 160–284 upgrades por segundo
contra un superviviente que se ha visto aguantar unos 50/s y atascarse 3–4 s con 160–284/s. Los clientes de otros monorepos no se pueden
tocar, así que el servidor reparte lo único que controla: cuándo les dice que se vayan.

- **Menos de 50 clientes abiertos:** todos a la vez, como siempre (servidores pequeños, pruebas, paneles del navegador).
- **En Cloud Run (`K_SERVICE` definida):** nunca se escalona, todos a la vez como hoy. Su gracia es de 10 s, no cabe una ventana de hasta 10 s y no se sabe cuántos servidores WS hay en lambdas.
- **50 o más:** los clientes se barajan y se avisan **equiespaciados** en una ventana de `clientes / 40` segundos (≈ 40 clientes por
  segundo), con tope de 10 s y nunca más de `timeoutMs − 5 s − 1 s` (así el último, que tiene 5 s para cerrar, acaba antes de
  que el apagado fuerce el cierre). Con el `shutdownTimeout` de producción (18 s) manda el tope de 10 s; con el de desarrollo
  (2 s) o el de las pruebas la ventana es 0.
- Una línea `info` al empezar (`Servidor WebSocket: Shutdown escalonado a N clientes en W ms`); con menos de 50 no hay línea.
- **Efecto:** el apagado de un servidor con 50 clientes o más **tarda hasta 10 s más** (siempre dentro de `shutdownTimeout`). Mientras
  dura la ventana el servidor sigue atendiendo a los clientes que aún no han recibido el aviso.
- **`Alive` hasta el final:** cada cliente sigue recibiendo sus `"Alive"` hasta justo antes de su `"Shutdown"` (el intervalo de
  liveness se borra por cliente, no al empezar el apagado), así que la ventana no afecta al `heartbeatTimeoutMs` de ningún cliente.
- El `info` de inicio incluye el ritmo efectivo (clientes/s): con más de 400 clientes la ventana topa en 10 s y deja de ser 40/s.
- Las funciones (`ventanaApagadoMs`, `retrasosApagado`, `vidaConexionMs` y sus constantes) son puras y están en `escalonado.ts`.

`Server.close()` del servidor HTTP lo llama por su cuenta (`servidorWebSocketActual()`, que devuelve el singleton sin crearlo) al cerrar por señal, en paralelo al cierre del servidor HTTP: no hace falta llamarlo desde el servicio.

### Implementar un handler

Cada handler implementa la interfaz `IWSHandler` e indica los métodos que sabe gestionar.

```ts
import type { IWSHandler } from "@mr/core-network/server/websocket/handler";
import { WSHandler }       from "@mr/core-network/server/websocket/handler";

interface GetNombreParams {
    locale: string;
}

export class NombreHandler implements IWSHandler {
    // Métodos que este handler atiende
    public method = ["getNombre"];

    public async handler<T>(ws: WSHandler, params: T): Promise<void> {
        const { locale } = params as GetNombreParams;

        const nombre = await buscarNombre(locale);

        // Respuesta única (done = true por defecto)
        ws.sendRespuesta({ data: { nombre } });
    }
}
```

#### Ruta propia y autorización en el handshake

Por defecto un handler es **global**: sus métodos se resuelven en las conexiones de cualquier ruta
(el servidor acepta el upgrade en cualquier path). Con `ruta` el handler pasa a ser **de una ruta**, y con
`autorizar` esa ruta exige credenciales en el handshake:

```ts
export class HeartbeatHandler implements IWSHandler {
    public method = ["heartbeat"];
    public ruta = "/status/external/heartbeat/";

    public autorizar(req: IncomingMessage): boolean {
        return req.headers["x-mr-heartbeat"] === process.env["TOKEN"];
    }

    public async handler<T>(ws: WSHandler, params: T): Promise<void> {
        // ws.ruta y ws.request (cabeceras del upgrade) están disponibles
    }
}
```

- **`ruta`**: path exacto; con o sin barra final es lo mismo y la query se ignora (`/a/b`, `/a/b/` y
  `/a/b/?x=1` son la misma). La conexión que hace upgrade a esa ruta queda **ligada** a ella y solo resuelve
  los métodos de los handlers de esa ruta; **nunca** los globales. Al revés, una conexión a cualquier otra
  ruta solo resuelve handlers sin `ruta`. Los dos espacios de nombres son independientes (el mismo método
  puede existir en ambos). Sin `ruta` todo funciona exactamente como antes (p. ej. la ingesta de logs de
  `status-external`).
- **`autorizar(req)`**: se evalúa **una vez, en el handshake** (no por mensaje), solo para la ruta del
  handler. Puede ser síncrona o devolver una `Promise`. Si devuelve `false`, rechaza o lanza, el upgrade
  termina con `401 Unauthorized` y el socket no llega a abrirse (un error se registra con `warning`). Si
  varios handlers de la misma ruta la declaran, tienen que autorizar **todos**. Una ruta con handlers pero
  sin `autorizar` es de acceso libre (aunque aislada). `autorizar` sin `ruta` no tiene efecto.
- `WSHandler` expone `ruta` (normalizada, o `undefined`) y `request` (la `IncomingMessage` del upgrade:
  cabeceras, IP de origen…).

**Cómo convive con `IUpgradeHandler`:** el rechazo se decide con `verifyClient` de `ws`, dentro del propio
handshake del `WebSocketServer`. El upgrade lo sigue atendiendo un único listener (el de `ws`); no se añade
otro listener ni se pasa a `noServer`, así que no hay dos escritores sobre el mismo socket. La restricción
de no declarar `getWSHandlers()` y `getUpgradeHandlers()` en el mismo servicio sigue vigente.

#### Enviar un error desde el handler

```ts
public async handler<T>(ws: WSHandler, params: T): Promise<void> {
    try {
        const resultado = await operacionPeligrosa(params);
        ws.sendRespuesta({ data: resultado });
    } catch (err) {
        ws.sendError("Ha ocurrido un error interno", err);
    }
}
```

> **Timeout de handler:** si el handler no completa en 30 s el cliente recibe automáticamente
> un error `Handler timeout (30000ms) for method …`. Para handlers que necesiten más tiempo,
> define `timeoutMs` en la clase:
>
> ```ts
> export class InformeHandler implements IWSHandler {
>     public method = ["/informe/pesado/"];
>     public timeoutMs = 120_000; // 2 minutos en lugar de los 30 s por defecto
>
>     public async handler<T>(ws: WSHandler, params: T): Promise<void> {
>         ws.sendRespuesta({ data: await generarInforme(params) });
>     }
> }
> ```

### Respuestas en streaming (servidor)

Envía varios fragmentos con `done = false` y cierra el stream con `done = true`.

```ts
export class StreamHandler implements IWSHandler {
    public method = ["getStream"];

    public async handler<T>(ws: WSHandler, params: T): Promise<void> {
        const items = await obtenerLista(params);

        for (let i = 0; i < items.length; i++) {
            const esFinal = i === items.length - 1;
            ws.sendRespuesta(
                { data: { item: items[i] } },
                undefined,   // metadata
                esFinal,     // done
            );
        }
    }
}
```

> **Backpressure automático:** `WSHandler` incorpora una cola FIFO interna. Cuando el buffer de salida del socket supera 64 KB, el bucle de envío espera automáticamente al evento `drain` antes de continuar. No es necesario gestionar el backpressure desde el handler.

#### Enviar un frame binario desde el handler

Para incluir un `ArrayBuffer` en la respuesta basta con añadir la propiedad `buffer` al objeto de respuesta. El mensaje JSON se envía con `buffer: true` y el frame binario llega como mensaje separado a continuación.

```ts
// Con datos JSON y frame binario
ws.sendRespuesta({ data: { tipo: "jpeg" }, buffer: miArrayBuffer });
```

El servidor ejecuta el handler normalmente, pero:
- Con `head: true` — `sendRespuesta` y `sendError` son **no-op**: el handler puede ejecutar cualquier lógica (escritura en base de datos, invalidación de caché…) pero no puede enviar nada al cliente.
- Sin `head` — comportamiento habitual.

> **Nota:** `head: true` no implica que el handler sea más rápido ni que se omita el span Datadog. El handler se ejecuta íntegramente; solo se suprimen los envíos de respuesta.

### Liveness y shutdown automático

El servidor envía automáticamente mensajes de control sin `id` (definidos en el enum `EWSControlMessage`) que el cliente ignora en el contexto de peticiones:

| Valor del enum             | Valor en JSON  | Cuándo se envía |
|----------------------------|----------------|-----------------|
| `EWSControlMessage.Ready`    | `"Ready"`    | Al establecer la conexión. |
| `EWSControlMessage.Alive`    | `"Alive"`    | Cada 10 s mientras la conexión no haya superado su vida. |
| `EWSControlMessage.Shutdown` | `"Shutdown"` | Cuando la conexión supera su vida, o en el apagado del servidor (ver «Shutdown escalonado»); da 5 s al cliente para cerrar limpiamente. |

**La vida de una conexión es de 7 a 9 min**: 540 s menos un jitter aleatorio de hasta 120 s, fijado al conectar. Como la edad solo
se mira en el intervalo de `"Alive"` (10 s), la vida real se redondea hacia arriba a múltiplos de 10 s: 12 escalones, de 430 a 540 s. Antes eran 540 s
exactos para todas, así que una cohorte de conexiones abiertas en la misma ráfaga (tras una reconexión masiva) se reciclaba
entera a la vez, y esa avalancha se repetía cada 9 min. El jitter va solo hacia abajo: no se supera nunca los 540 s.

El cliente puede importar el enum para comparar mensajes de control recibidos:

```ts
import { EWSControlMessage } from "@mr/core-network/server/websocket";

// Dentro del handler de mensajes de control del cliente:
if (msg.data === EWSControlMessage.Shutdown) {
    console.warn("El servidor va a cerrar la conexión.");
}
```


---

## Cliente

La documentación del cliente WebSocket (pool de conexiones, circuit breaker, reconexión automática, backoff exponencial, timeouts, streaming y métodos `next`/`consume`/`pipe`) se encuentra en [`client/websocket/README.md`](../../client/websocket/README.md).


## Trazabilidad con Datadog

El módulo implementa **propagación de traza distribuida** entre cliente y servidor. No se requiere configuración adicional: todo ocurre automáticamente al usar `WSPool.get()`.

### Cómo funciona

1. **Cliente** — `WSPool.get()` anota el span HTTP activo con `websocket.method` e inyecta su contexto de traza (formato TEXT_MAP) en el campo `_datadog` del mensaje JSON. No se crea un span propio.
2. **Servidor** — `handleRequest()` extrae el contexto de `data._datadog` y lo usa como padre del span `websocket.<method>`. Si el cliente no envía `_datadog`, usa el span del upgrade HTTP como fallback.

### Traza resultante en Datadog

```
[Servicio A — HTTP request]   ← websocket.method y websocket.id como tags
    └── [Servicio B]
        websocket./mi/metodo/    (span.kind: server)
            └── (sub-spans del handler)
```

### Tags disponibles

| Tag                  | Dónde aparece | Valor |
|----------------------|---------------|-------|
| `websocket.method`   | Span HTTP padre (cliente) | URL del método llamado |
| `websocket.type`     | Span HTTP padre (cliente) | `"get"` o `"head"` |
| `websocket.id`       | Span HTTP padre (cliente) | UUID de correlación |
| `websocket.method`   | `websocket.<method>` (servidor) | URL del método |
| `websocket.id`       | `websocket.<method>` (servidor) | UUID de correlación |
| `error`              | Span afectado | Objeto de error (si falla) |

---

## Flujo completo de una petición

```
Cliente                                        Servidor
  │                                                │
  │── JSON { id, method, buffer, params,           │
  │          _datadog: {trace-id, parent-id} } ───►│
  │── [ArrayBuffer si buffer=true]  ──────────────►│
  │                                                │  handleMessage()
  │                                                │  handleRequest()  ← span websocket.<method>
  │                                                │  → IWSHandler.handler()
  │◄── JSON { id, ok:true, done:false, … } ────────│  sendRespuesta(…, false)
  │◄── JSON { id, ok:true, done:false, … } ────────│  sendRespuesta(…, false)
  │◄── JSON { id, ok:true, done:true,  … } ────────│  sendRespuesta(…, true)
  │                                                │
  │  [generator termina]                           │
  │  [conexión vuelve al pool]                     │
```

En caso de error:

```
  │◄── JSON { id, ok:false, info:{message} } ───────│  sendError(…)
  │  [generator termina]                            │
  │  [error anotado en span HTTP padre]             │
```

Petición fire-and-forget (`head: true`):

```
Cliente                                        Servidor
  │                                                │
  │── JSON { id, method, head:true, params, … } ──►│
  │                                                │  handleMessage()
  │  [conexión vuelve al pool inmediatamente]      │  handleRequest()  ← span websocket.<method>
  │                                                │  → IWSHandler.handler()
  │                                                │  sendRespuesta() → no-op (silenciado)
  │                                                │  sendError()     → no-op (silenciado)
```

---

## Referencia rápida de interfaces

| Símbolo                       | Fichero                                        | Descripción |
|-------------------------------|------------------------------------------------|-------------|
| `IMessageClient<T>`           | `metadata/websocket/message.ts`                | Mensaje enviado por el cliente. `buffer: true` indica frame binario adjunto; `head: true` indica fire-and-forget (el servidor no envía respuesta). |
| `IMessageServerOK<T>`         | `metadata/websocket/message.ts`                | Respuesta exitosa del servidor (`buffer` indica si va acompañada de un frame binario; `data` puede ser `undefined` cuando `buffer: true`). |
| `IMessageServerKO`            | `metadata/websocket/message.ts`                | Respuesta de error del servidor. |
| `MessageServer<T>`            | `metadata/websocket/message.ts`                | Unión discriminada de las dos anteriores. |
| `IMetadata`                   | `metadata/websocket/message.ts`                | Metadatos opcionales de respuesta (`expires`). |
| `IStreamFrame`                | `metadata/websocket/message.ts`                | Par `{ message, buffer? }` que produce el generator: el mensaje JSON del servidor y el `ArrayBuffer` opcional asociado. |
| `EWSControlMessage`           | `server/websocket/index.ts`                    | Enum con los mensajes de control (`Ready`, `Alive`, `Shutdown`). |
| `IWSHandler`                  | `server/websocket/handler.ts`                  | Interfaz que deben implementar los handlers. Opcionales: `ruta` (path exacto del upgrade), `autorizar(req)` (handshake, 401 si falla) y `timeoutMs`. |
| `WSHandler`                   | `server/websocket/handler.ts`                  | Wrapper de conexión con helpers `sendRespuesta` / `sendError`. Ambos son no-op si la petición llegó con `head: true`. Expone `buffer`, `ruta` y `request`; su constructor recibe `{buffer, head, ruta, request}` como objeto de configuración. |
| `normalizarRuta(ruta)`        | `server/websocket/handler.ts`                  | Path sin query y con barra final; así se comparan las rutas. |
| `IHandlerRespuesta<T>`        | `server/websocket/handler.ts`                  | Carga útil del handler: `{ data: T; buffer?: ArrayBuffer }`. Con `buffer` envía un frame binario tras el JSON; sin él, solo JSON. |
| `WSPool`                      | `client/websocket/index.ts`                    | Pool de conexiones WebSocket del lado cliente. `get()` — petición con respuesta; `head()` — fire-and-forget sin respuesta. |
| `Result`                      | `client/websocket/result.ts`                   | Resultado de `WSPool.get()`: encapsula el generator y expone `next()`, `consume()` y `pipe()`. `next()` solo acepta la firma sin parámetros; para Deferreds con fallback usar `pipe()`, sin fallback usar `consume()`. |
