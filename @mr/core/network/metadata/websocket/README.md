# `@mr/core-network/metadata/websocket`

Interfaces del protocolo WebSocket compartidas por el cliente (`client/websocket/`) y el servidor (`server/websocket/`).

---

## Contenido

| Fichero | Entrada | Descripción |
|---------|---------|-------------|
| [`message.ts`](#interfaces-del-protocolo) | `@mr/core-network/metadata/websocket/message` | Interfaces del protocolo: mensajes de cliente y servidor, metadatos y stream frames |

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
| `IMessageClient<T>` | Mensaje enviado por el cliente al servidor. `buffer: true` indica frame binario adjunto; `head: true` indica fire-and-forget (el servidor no envía respuesta). |
| `IMetadata` | Metadatos opcionales de la respuesta (`expires` — timestamp Unix en segundos). |
| `IMessageServerOK<T>` | Respuesta exitosa del servidor. `done: false` en frames intermedios de stream; `done: true` en el último. `data` puede ser `undefined` cuando `buffer: true`. |
| `IMessageServerKO` | Respuesta de error del servidor (`info.message`, `info.extra`). |
| `MessageServer<T>` | Unión discriminada `IMessageServerOK<T> \| IMessageServerKO`. Usar `ok` como discriminante. |
| `IStreamFrame` | Par `{ message: MessageServer; buffer?: ArrayBuffer }` que el generator del cliente produce por cada respuesta. |

---

## Changelog

Consulta [`CHANGELOG.md`](../../CHANGELOG.md) para el historial de cambios del paquete.

