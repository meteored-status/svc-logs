# CODEMAP — `@mr/core-network`

> Segmentado por bloques con README propio.
> Cada sección indica los ficheros relevantes, los símbolos clave y las relaciones entre ellos.

---

## 1. Raíz — `@mr/core-network`

**README:** [`README.md`](./README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `index.ts` | `IResponse<T>` |

### Símbolos

#### `IResponse<T>`
Tipo base devuelto por todos los métodos de red del monorepo (HTTP y WebSocket).

```
IResponse<T>
  data: T
  expires?: number       — timestamp Unix (ms) de expiración de caché
  buffer?: ArrayBuffer   — frame binario (solo respuestas WS con buffer: true)
```

**Usado por:** `Result.next()`, `Result.consume()`, `Result.pipe()` en `client/websocket`.

---

## 2. Routing — `route/`

**README:** [`route/README.md`](./route/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `route/index.ts` | `Route`, `IRoute`, `IRouteOptions`, `IRouteBuilderOptions`, `TRouteRunner<C,T>`, `TParams` |
| `route/factory/exact/index.ts` | `ICrearExactOptions` |
| `route/factory/exact/get.ts` | `crearExactGET` (default export) |

### Símbolos

#### `Route`
Modela una ruta de la aplicación: URLs por idioma, expresiones de matching y lógica de ejecución de handlers.

```
Route
  nombre: string
  expresiones: IExpresion[]
  idiomas: Idioma[]
  idiomaDefecto: Idioma
  ─────────────────────────────────────────────
  checkLang(lang)                 → boolean
  getPath(lang, params?)          → string        — patrón /path con sustitución {param}
  getURL(lang, opts?)             → string        — URL absoluta (dominio + path traducido)
  run(conexion, config, runner, opts?) → Promise<P>  — valida idioma, normaliza params y ejecuta el runner
  redir(_conexion)                → Promise<string>  — override point para redirecciones
```

**Depende de:** `Dominio`, `Idioma` (i18n), `IExpresion` (checkers), `Conexion` (server/http).

#### `TRouteRunner<C, T>`
```ts
type TRouteRunner<C, T> = (config: C, options: IRouteBuilderOptions) => Promise<T>
```
Función handler de negocio recibida por `Route.run()`.

#### `IRouteBuilderOptions`
Contexto de petición inyectado al runner: `{ lang, dominio, url, device, section, params }`.

#### `crearExactGET(nombre, url, options)` → `Route`
Factory para rutas exactas GET. Construye el `IRoute` con las `expresiones` de matching ya configuradas.

```
crearExactGET
  ← nombre: string
  ← url: string           — p.ej. "/tiempo/madrid"
  ← ICrearExactOptions
      dominio: Dominio
      dominios?: string[]  — por defecto [BASE, WWW]
      idiomas: Idioma[]
      metodos?: TMetodo[]  — por defecto ["GET"]
  → Route
```

---

## 3. Cliente (resumen) — `client/`

**README:** [`client/README.md`](./client/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `client/factory.ts` | `factoryCache<T>`, `IFactoryCache<T>`, `IFactoryExpires<T>`, `IFactoryOptions<T>` |
| `client/ua.ts` | `randomUA()` |

### Símbolos

#### `factoryCache<T>(options)` → `Promise<IFactoryExpires<T>>`
Caché genérica con expiración automática para peticiones asíncronas. Previene stampede guardando la `Promise` en curso mientras se resuelve, luego programa un `setTimeout` para invalidar la entrada.

```
IFactoryOptions<T>
  nombre: string          — aparece en logs de tiempo de carga
  cache: TCache<T>        — mapa compartido (Record<string, IFactoryCache<T>>)
  key: string             — clave de la entrada
  fn: () => Promise<IFactoryExpires<T>>
  defaultTimeout?: number — ms de expiración cuando no se puede calcular desde expires

IFactoryExpires<T>
  data: T
  expires: number         — timestamp Unix (ms)
```

#### `randomUA()` → `string`
Devuelve un User-Agent real aleatorio (Chrome/Firefox/Safari/Edge, desktop+mobile).

---

## 4. Cliente HTTP — `client/http/`

**README:** [`client/http/README.md`](./client/http/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `client/http/interface.ts` | `ErrorCode`, `IErrorInfo`, `IOK<T>`, `IRespuestaOK<T>`, `IRespuestaKO<T>`, `IRespuesta<T>` |
| `client/http/error.ts` | `RequestError`, `IRequestError` |
| `client/http/respuesta.ts` | `Respuesta<T>` |
| `client/http/parser/index.ts` | `Parser<T>` (tipo) |
| `client/http/parser/respuesta.ts` | `parser` (default, parsea `IRespuesta<T>`) |
| `client/http/parser/json.ts` | parser JSON crudo |
| `client/http/parser/text.ts` | parser texto |
| `client/http/parser/buffer.ts` | parser Buffer |
| `client/http/parser/array-buffer.ts` | parser ArrayBuffer |
| `client/http/parser/void.ts` | parser void |
| `client/http/peticion/index.ts` | `Peticion` (abstract), `IRequestConfig`, `RequestMethod` |
| `client/http/peticion/get.ts` | `PeticionGET` |
| `client/http/peticion/post.ts` | `PeticionPOST` |
| `client/http/peticion/put.ts` | `PeticionPUT` |
| `client/http/peticion/patch.ts` | `PeticionPATCH` |
| `client/http/peticion/delete.ts` | `PeticionDELETE` |
| `client/http/peticion/head.ts` | `PeticionHEAD` |
| `client/http/peticion/data.ts` | base para peticiones con cuerpo |

### Símbolos

#### `ErrorCode` (const enum)
```
NETWORK=1  TIMEOUT=2  AUTHENTICATION=3  RESPONSE=4  APPLICATION=5
NO_DATA_TEMPORARY=6  NO_DATA_PERMANENT=7  NO_DATA=8
```

#### `IRespuesta<T>` = `IRespuestaOK<T> | IRespuestaKO<T>`
Discriminante `ok: boolean`. Formato estándar de respuesta del API interno.

```
IRespuestaOK<T>   ok:true   expiracion:number  data:T  info?:IErrorInfo
IRespuestaKO<T>   ok:false  expiracion?:number data?:T info:IErrorInfo
```

#### `RequestError extends CustomError`
Error lanzado por `Peticion` cuando la petición no completa correctamente.
Propiedades adicionales: `status`, `url`, `headers`, `code: ErrorCode`, `extra?`.

#### `Respuesta<T>`
Encapsula la respuesta HTTP parseada.
```
Respuesta<T>
  status: number
  headers: Headers
  data: T
  expires: Date       — de cabecera Expires o parámetro expiracion
  cacheable: boolean  — true solo si la respuesta traía cabecera Expires
```

#### `Peticion` (abstract)
Clase base para todas las peticiones HTTP. El constructor es `protected`; se usa siempre el método estático `run()` de cada subclase.

```
Peticion
  urlOriginal: string
  url: string              — puede mutar por fallback a dominioAlternativo en dev
  protected init()         — construye RequestInit; sobreescribible por subclases
  protected run(parser)    — ejecuta fetch + fallback dev + normalización de errores
```

**Subclases:** `PeticionGET`, `PeticionPOST`, `PeticionPUT`, `PeticionPATCH`, `PeticionDELETE`, `PeticionHEAD`.
Todas exponen `static run(url, parser, cfg?)`.

#### `Parser<T>`
```ts
type Parser<T> = (response: Response) => Promise<Respuesta<T>>
```
Parsers disponibles: `respuesta` (IRespuesta), `json`, `text`, `buffer`, `arrayBuffer`, `void`.

---

## 5. Cliente WebSocket — `client/websocket/`

**README:** [`client/websocket/README.md`](./client/websocket/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `client/websocket/index.ts` | `WSPool` |
| `client/websocket/result.ts` | `Result`, `WSConnectionError` |
| `client/websocket/error.ts` | (re-exportado desde `result.ts`) |

### Símbolos

#### `WSPool`
Pool de conexiones WebSocket reutilizables con circuit breaker, reconexión automática y heartbeat.

```
WSPool                                    (singleton por socket+reconnect)
  ─ static ─────────────────────────────────────────────────────
  get(cfg: IWSPoolConfig)           → WSPool   — factory singleton
  ─ instance ────────────────────────────────────────────────────
  head(method, params?)             → Promise<void>        — fire-and-forget
  get(method, params?, buffer?)     → Promise<Result>      — streaming con respuesta
  getCircuitState()                 → CircuitState
```

**Circuit breaker:** `Closed` → tras 5 fallos → `Open` (30s) → `HalfOpen` → prueba → `Closed`.
**Reconexión:** backoff exponencial (100ms base, 5s máx), hasta 3 intentos sin frames entregados.
**Heartbeat:** timeout configurable (45s por defecto); cierra la conexión si no llegan mensajes.

```
IWSPoolConfig
  socket: string
  minConnections?: number        — mínimo 10
  reconnect?: boolean            — true por defecto
  requestTimeoutMs?: number      — 30 000 ms por defecto
  heartbeatTimeoutMs?: number    — 45 000 ms por defecto
```

#### `Result`
Encapsula el `AsyncGenerator<IStreamFrame>` de `WSPool.get()`.

```
Result
  generator: AsyncGenerator<IStreamFrame>
  ──────────────────────────────────────
  next<T>()                → Promise<IResponse<T>>
  consume<T>(promise, deferred?) → Promise<IResponse<T>> | void
  pipe(...deferreds)       → Promise<void>   — N lecturas paralelas con fallback HTTP
```

#### `WSConnectionError extends Error`
Error interno de caída de red (vs. timeout). El circuit breaker solo reacciona a este tipo.

---

## 6. Servidor (resumen) — `server/`

**README:** [`server/README.md`](./server/README.md)

Punto de entrada conceptual que describe la integración entre `server/http` y `server/websocket`.
No contiene ficheros `.ts` propios; agrupa los dos sub-bloques siguientes.

---

## 7. Servidor HTTP — `server/http/`

**README:** [`server/http/README.md`](./server/http/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `server/http/server.ts` | `Server` (clase), `default` (singleton) |
| `server/http/router.ts` | `route()`, `IErrorHandler`, `IShutdownHandler` |
| `server/http/conexion.ts` | `Conexion`, `TMetodo`, `TStatus` (enum) |
| `server/http/respuesta.ts` | `Respuesta` (builder de cabeceras/envío) |
| `server/http/request-context.ts` | `RequestContext` |
| `server/http/routes/index.ts` | `Routes` |
| `server/http/routes/group/index.ts` | `RouteGroup<T>`, `RouteGroupError<T>`, `IRouteGroupParams`, `IConfigError` |
| `server/http/routes/group/block.ts` | `RouteGroupBlock`, `IRouteGroup` |
| `server/http/checkers/index.ts` | `Checker` (abstract), `IExpresion` |
| `server/http/checkers/exact.ts` | `Exact` |
| `server/http/checkers/prefix.ts` | `Prefix` |
| `server/http/checkers/regex.ts` | `Regex` |
| `server/http/checkers/comodin.ts` | `Comodin` |
| `server/http/checkers/query/` | `ExactQuery`, `PrefixQuery`, `RegexQuery`, `AnyQuery`, `OptionsQuery` |
| `server/http/i18n.ts` | `Idioma` (clase), helpers de idioma |
| `server/http/config/device.ts` | `TDevice` |
| `server/http/config/dominio.ts` | `Dominio` |
| `server/http/config/net.ts` | `Net`, `INet`, `INetService`, `INetServiceBase` |
| `server/http/service.ts` | `Service` |
| `server/http/metrics.ts` | `metricas` (Datadog histograma) |
| `server/http/upgrade.ts` | `IUpgradeContext`, `TUpgradeRunner`, `IUpgradeHandler`, `IUpgradeContextConfig`, `IProxyUpgradeConfig`, `buildUpgradeContext()`, `matchUpgradeHandler()`, `protegerSocket()`, `abortUpgrade()`, `proxyUpgrade()` |
| `server/http/error.ts` | `HttpError` |
| `server/http/schema/spec.ts` | `ISchemaSpec`, tipos de esquema |
| `server/http/schema/spec-to-type/` | conversión spec → tipo TS |
| `server/http/schema/validation/backend/` | validación de cuerpo con el esquema |
| `server/http/utiles/path.ts` | utilidades de normalización de paths |

> **Migración:** los handlers predefinidos (`admin`, `error`, `favicon`) se han trasladado
> a [`@mr/core-workload/handlers/`](../../workload/CODEMAP.md).
> Actualizar imports a `@mr/core-workload/handlers/{admin,error,favicon}`.
>
> **Migración:** la configuración base de red (`ConfiguracionNet`) ya no está en
> `server/http/config/config.ts` y se ha movido a
> [`@mr/core-workload/config/net.ts`](../../workload/config/net.ts).
> Actualizar imports a `@mr/core-workload/config/net`.

### Jerarquía de enrutamiento

```
Server (singleton)
  iniciarHTTP(routes, config, upgrades?)  → http.Server
  iniciarHTTPs(routes, config, upgrades?) → Promise<https.Server>   (solo dev, TLS SNI multi-dominio)
  close(timeoutMs)             → Promise<void>            (graceful shutdown, SIGTERM/SIGINT)
  cederPuertoParaDebug()       → Promise<void>            (solo !PRODUCCION, ver abajo)
        │
        ▼
  route(handlers: Routes, conexion: Conexion)
        │
        ▼
  Routes
    groups: RouteGroup[]
    error:  RouteGroupError
    check(conexion)              → Promise<boolean>
    collectAllowedMethods(conn)  → Set<TMetodo>   (para 405 Method Not Allowed)
        │
        ▼
  RouteGroup<T>  (abstracta)
    dominios?: string[]  — pasado en params; heredado por cada IRouteGroup de getHandlers()
                           que no defina el suyo propio (mismo principio que IRouteGroup.dominios)
    getHandlers()         → IRouteGroup[]      (implementada por subclase)
    getWSHandlers()       → IWSHandler[]       (opcional; arranca el servidor WS, termina el WS aquí)
    getUpgradeHandlers()  → IUpgradeHandler[]  (opcional; recibe el socket crudo y puede reenviarlo)
    check(conexion) → Promise<boolean>
    sendRespuesta(conexion, opts)     → Promise<number>
    sendError(conexion, data?, opts?) → Promise<number>
        │
        ▼
  RouteGroupBlock
    expresiones: Checker[]
    handler: (conexion, captures) → Promise<number>
    updater?: { interval?, exec }  — recarga dinámica de expresiones
    dominios?: string[]  — heredado por cada IExpresion de `expresiones` que no defina el suyo propio
    check(conexion, metodo) → Promise<boolean>
```

**`upgrades` no pasa por `Checker`:** el evento nativo `'upgrade'` no trae `ServerResponse`,
por lo que no puede construirse una `Conexion`. El matching de `IUpgradeHandler` (host exacto +
prefijo de path) vive directamente en `server/http/upgrade.ts` — ver más abajo.

### `Conexion`
Representa la petición HTTP entrante y su respuesta. Compone `RequestContext` (inmutable) + `Respuesta` (envío).

```
Conexion extends Respuesta
  ─ static ──────────────────────────────────────────
  buildRespuesta<T>(opts?)  → IRespuestaOK<T>
  buildError(data?)         → IRespuestaKO
  ─ instance ─────────────────────────────────────────
  request: RequestContext
  https, start, path, get, dominio, idioma, query,
  requestId, metodo, accept, userAgent, url, ip,
  clientIp, ifModifiedSince, ifNoneMatch, device,
  post, postRAW, files                              ← getters/setters delegados a request
  ─────────────────────────────────────────────────
  checkETag(etag)       → boolean
  getPeticion()         → IncomingMessage
  enableCors/disableCors()
  getSpan()             → Span | null               — span Datadog activo
  setRoute(resumen)                                 — renombra el span para Datadog APM
  getQuery<T>()         → T                         — query string parseada con qs
  iniciado/preparando/transfiriendo/terminado()     — avance del ciclo de vida
  isTerminado()         → boolean
```

### `upgrade.ts` — reenvío de peticiones `Upgrade:` HTTP/1.1

Mecanismo genérico para atender/reenviar el evento nativo `'upgrade'` (WebSocket de aplicación,
HMR de bundlers). Ver el detalle completo en
[`server/http/README.md#upgrade`](./server/http/README.md#upgrade).

```
buildUpgradeContext(request, socket, head, {https?, trustProxy?}) → IUpgradeContext
matchUpgradeHandler(handlers: IUpgradeHandler[], contexto)        → IUpgradeHandler|undefined
protegerSocket(socket)                                            → void
abortUpgrade(socket, status, mensaje)                             → void
proxyUpgrade(contexto, base, {host?, headers?, timeout?})         → Promise<void>

IUpgradeContext   request, socket, head, dominio, path, https
IUpgradeHandler   resumen, dominios?, prefix?, handler: TUpgradeRunner
```

**Usado por:** `RouteGroup.getUpgradeHandlers()`, `Server.crearListenerUpgrade()` (privado, en
`iniciarHTTP`/`iniciarHTTPs`), `Engine.iniciar()` de `@mr/core-workload` y, como consumidor final,
`services/proxy` (`Proxy.buildUpgrade`/`proxyUpgradeEjecutar`).

### Checkers (`IExpresion` → `Checker`)

```
IExpresion
  dominios?: string[]
  metodos?: TMetodo[]
  lang?: { include?: Idioma[], exclude?: Idioma[] }
  exact?:   string    → Exact
  prefix?:  string    → Prefix
  regex?:   RegExp    → Regex
  comodin?: true      → Comodin
  resumen:  string
  query?:   IQueryExpresion[]

Checker (abstract)
  match(conexion, metodo) → string[] | null    — null = no match; array = grupos capturados
  resumen: string
```

### `Service`
Registro central de servicios. Calcula puertos HTTP/HTTPS de forma determinista (MD5 del DNS) y soporta alias.

```
Service
  configuracion(id: number | string)  → INet
  servicio(id: number)                → ConfigService
```

### `Dominio`
Resuelve nombres de dominio para el entorno actual (dev/prod) y genera URLs con protocolo.

### `TDevice`
```ts
type TDevice = "pc" | "mv"
```

---

## 8. Servidor WebSocket — `server/websocket/`

**README:** [`server/websocket/README.md`](./server/websocket/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `server/websocket/index.ts` | `WebSocket` (clase, default export singleton), `EWSControlMessage` |
| `server/websocket/handler.ts` | `WSHandler`, `IWSHandler` |

### Símbolos

#### `WebSocket` (singleton)
Gestiona el ciclo de vida de todas las conexiones WebSocket sobre el servidor HTTP.

```
WebSocket
  constructor(http: Server, handlers: IWSHandler[])
  addHandlers(handlers: IWSHandler[])    — registra handlers adicionales en caliente
  shutdown(timeoutMs)   → Promise<void>  — drena conexiones activas, rechaza nuevas
```

**Constantes de ciclo de vida:**
- `INTERVAL_ALIVE_MS = 10 000` — ping periódico (`"Alive"`)
- `MAX_LIVENESS_MS = 540 000` — vida máxima de una conexión antes de `"Shutdown"`
- `MAX_SHUTDOWN_MS = 5 000` — espera al cierre limpio del cliente
- `MAX_CONCURRENT_REQUESTS = 10` — límite de handlers en vuelo por conexión
- `HANDLER_TIMEOUT_MS = 30 000` — timeout por handler

**Mensajes de control** (`EWSControlMessage`): `Ready` | `Alive` | `Shutdown`.

**Protocolo de buffer binario:** si el cliente envía `buffer: true` en el JSON, el servidor espera el siguiente frame binario antes de invocar al handler.

**Integración Datadog:** crea un span hijo `websocket.<method>` por petición; propaga el contexto del cliente vía `_datadog` (TEXT_MAP).

#### `IWSHandler`
Contrato que implementan los handlers de mensajes WebSocket.

```
IWSHandler
  metodos: string[]           — lista de nombres de método que gestiona
  timeoutMs?: number          — timeout propio (sobreescribe el global)
  handler: (ws: WSHandler, params: unknown) → Promise<void>
```

#### `WSHandler`
Objeto inyectado al handler con la API de respuesta hacia el cliente.

```
WSHandler
  sendRespuesta<T>(data, opts?) → Promise<void>   — envía IMessageServerOK (done:false por defecto)
  sendError(message, extra?)    → Promise<void>   — envía IMessageServerKO
  buffer?: ArrayBuffer                            — frame binario adjunto a la petición
```

**Flujo de integración con `server/http`:** si un `RouteGroup` sobreescribe `getWSHandlers()` devolviendo instancias de `IWSHandler`, el servidor HTTP instancia automáticamente el servidor WebSocket y registra los handlers.

---

## 9. Metadatos / Protocolo (resumen) — `metadata/`

**README:** [`metadata/README.md`](./metadata/README.md)

Directorio raíz de los tipos de protocolo compartidos entre cliente y servidor.
No contiene ficheros `.ts` propios; agrupa el sub-bloque siguiente.

---

## 10. Protocolo WebSocket — `metadata/websocket/`

**README:** [`metadata/websocket/README.md`](./metadata/websocket/README.md)
**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `metadata/websocket/message.ts` | `IMessageClient<T>`, `IMessageServerOK<T>`, `IMessageServerKO`, `MessageServer<T>`, `IStreamFrame`, `IMetadata` |

### Símbolos

#### `IMessageClient<T>`
Mensaje cliente → servidor.
```
IMessageClient<T>
  id: string            — UUID de correlación
  method: string        — nombre del handler a invocar
  buffer: boolean       — true si se enviará frame binario a continuación
  head?: boolean        — fire-and-forget; el servidor no responde
  params?: T
  _datadog?: Record<string, string>   — contexto de traza Datadog (TEXT_MAP)
```

#### `IMessageServerOK<T>` / `IMessageServerKO` / `MessageServer<T>`
Mensajes servidor → cliente.
```
IMessageServerOK<T>
  id, ok:true, buffer:boolean, done:boolean, data:T, metadata?: IMetadata

IMessageServerKO
  id, ok:false, info: { message:string, extra?:unknown }

MessageServer<T> = IMessageServerOK<T> | IMessageServerKO   — unión discriminada por ok
```

#### `IStreamFrame`
Par producido por el generator de `WSPool`:
```
IStreamFrame
  message: MessageServer
  buffer?: ArrayBuffer    — presente cuando IMessageServerOK.buffer === true
```

#### `IMetadata`
```
IMetadata
  expires?: number    — timestamp Unix (segundos) de validez de la respuesta
```

---

## Diagrama de dependencias entre bloques

```
metadata/websocket
      ▲
      │  (tipos de protocolo)
      ├──────────────────────────────────┐
      │                                  │
client/websocket ──→ IResponse (raíz)   server/websocket
      │                                  │
client/http                         server/http
      │                   ┌─────────────┤
      │                   │             │
      └───────── Peticion │         Conexion ──→ route/Route
                          │         RouteGroup
                          │         RouteGroupBlock
                          │         Checkers (Exact/Prefix/Regex/Comodin)
                          │
                     client (factory, ua)
```

**Regla de dependencia:** cliente nunca importa de servidor ni viceversa.
El protocolo (`metadata/websocket`) es el único punto de acoplamiento entre ambos lados.

