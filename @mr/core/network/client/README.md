# `@mr/core-network/client`

Utilidades de cliente de red: cliente WebSocket con pool y circuit breaker, peticiones HTTP, caché genérica y generación de User-Agents aleatorios.

---

## Contenido

| Fichero / Directorio | Descripción |
|----------------------|-------------|
| [`http/`](./http/README.md) | Tipos, errores, parsers y clases de petición HTTP |
| [`websocket/`](./websocket/README.md) | `WSPool` — cliente WebSocket con pool, circuit breaker y streaming |
| [`factory.ts`](#factorycache) | `factoryCache<T>()` — caché genérica con deduplicación y expiración |
| [`ua.ts`](#randomua) | `randomUA()` — User-Agent aleatorio de una lista curada |

---

## `factoryCache<T>`

**Entrada:** `@mr/core-network/client/factory`

Función genérica de caché para peticiones asíncronas con deduplicación por clave y expiración automática.

```ts
import {factoryCache} from "@mr/core-network/client/factory";
import type {IFactoryCache, IFactoryExpires, IFactoryOptions} from "@mr/core-network/client/factory";
```

### Interfaces

#### `IFactoryExpires<T>`

Resultado devuelto por la función de carga `fn` y por `factoryCache`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `data` | `T` | Valor del recurso cargado. |
| `expires` | `number` | Timestamp Unix (ms) a partir del cual la entrada se considera expirada. |

#### `IFactoryCache<T>`

Entrada interna del mapa de caché. Normalmente no se accede directamente fuera de `factoryCache`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `data` | `Promise<IFactoryExpires<T>>` | Promesa en curso (o ya resuelta) con el dato y su expiración. |
| `timeout` | `NodeJS.Timeout \| undefined` | Temporizador de expiración. `undefined` mientras la promesa no se ha resuelto. |

#### `IFactoryOptions<T>`

Parámetros de entrada para `factoryCache`.

| Propiedad | Tipo | Obligatorio | Descripción |
|-----------|------|:-----------:|-------------|
| `nombre` | `string` | ✅ | Nombre descriptivo del recurso; aparece en el log de tiempos de carga. |
| `cache` | `Record<string, IFactoryCache<T>>` | ✅ | Mapa compartido donde se almacenan las entradas activas. |
| `key` | `string` | ✅ | Clave que identifica unívocamente esta entrada dentro de `cache`. |
| `fn` | `() => Promise<IFactoryExpires<T>>` | ✅ | Función que carga el dato y devuelve su timestamp de expiración. |
| `defaultTimeout` | `number` | — | Duración del temporizador de expiración (ms). Si se omite, se calcula como `expires - Date.now()`. |

### Ciclo de vida de una entrada

1. **Primera llamada** → ejecuta `fn()` y almacena la promesa en `cache[key]`.
2. **Llamadas concurrentes** con la misma clave → reciben la misma promesa sin re-ejecutar `fn` (deduplicación).
3. **Al resolverse `fn()`:**
   - Si `expires` está en el futuro: programa un `setTimeout` para eliminar la entrada.
   - Si `expires` ya pasó: elimina la entrada inmediatamente.
4. **El tiempo de carga** se registra en el log solo en llamadas que causaron un *cache miss*.

### Ejemplo

```ts
import {factoryCache} from "@mr/core-network/client/factory";
import type {IFactoryCache} from "@mr/core-network/client/factory";

const cache: Record<string, IFactoryCache<ILocation>> = {};

async function getLocation(uid: string): Promise<ILocation> {
    const {data} = await factoryCache({
        nombre: "location",
        cache,
        key: uid,
        fn: async () => {
            const resp = await fetchLocation(uid);
            return { data: resp.data, expires: resp.expires };
        },
    });
    return data;
}
```

---

## `randomUA`

**Entrada:** `@mr/core-network/client/ua`

Devuelve un User-Agent aleatorio de una lista curada de navegadores reales de escritorio y móvil (2024–2025).
Útil para enmascarar peticiones HTTP salientes y evitar bloqueos por parte de servidores que filtran agentes no reconocidos.

```ts
import {randomUA} from "@mr/core-network/client/ua";

const headers = {
    "User-Agent": randomUA(),
};
```

### Cobertura de la lista

| Familia | Plataformas | Versiones |
|---------|-------------|-----------|
| Chrome | Windows, macOS, Linux | 124–130 |
| Firefox | Windows, macOS, Linux | 124–128 |
| Safari | macOS Sonoma, macOS Sequoia | 17.4–18.1 |
| Edge | Windows | 124–130 |
| Chrome | Android (Pixel, Samsung) | 124–128 |
| Samsung Internet | Android | 23–24 |
| Safari | iOS, iPadOS | 17.4–18.0 |

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios de este subdirectorio.

