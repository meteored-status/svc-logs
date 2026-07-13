# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.7.13 — [Jose]

### Changed

- **`package.json`** — `dd-trace` actualizado de `^5.113.0` a `^6.2.0`. Revisado el
  *changelog* oficial del major: los *breaking changes* de la v6 (Node.js ≥22 como mínimo
  soportado, retirada de APIs ya deprecadas de AppSec/plugins y cambios en Test Optimization)
  no afectan al uso actual en `server/http/conexion.ts`, `server/websocket/index.ts` y
  `client/websocket/index.ts` (`tracer` como default export, `type Span`, `formats` de
  `dd-trace/ext`). Sin cambios de código necesarios.

---

## 2026.6.16 — [Jose]

### Removed

- **`server/http/handlers/admin.ts`**, **`server/http/handlers/error.ts`**, **`server/http/handlers/favicon.ts`** —
  los tres handlers predefinidos se han trasladado a `@mr/core-workload/handlers/`.
  La razón es que `Admin` y `ErrorHandler` dependen de `Engine` (de `@mr/core-workload/engine/server`),
  creando una dependencia circular inversa si permanecían en `@mr/core-network`.
  - Los imports deben actualizarse:
    ```ts
    // Antes
    import Admin   from "@mr/core-network/server/http/handlers/admin";
    import ErrorH  from "@mr/core-network/server/http/handlers/error";
    import Favicon from "@mr/core-network/server/http/handlers/favicon";

    // Ahora
    import Admin   from "@mr/core-workload/handlers/admin";
    import ErrorH  from "@mr/core-workload/handlers/error";
    import Favicon from "@mr/core-workload/handlers/favicon";
    ```

---

## 2026.6.10+1 — [Jose]

### Added

- **`route/index.ts`** *(nuevo)* — módulo de routing HTTP transferido desde `@mr/core-templates/seccion`.
  Exporta la clase `Route` (antes `Seccion`) y los tipos `IRoute`, `IRouteOptions`, `IRouteBuilderOptions`,
  `TRouteRunner`, `TParams` y `crearExactGET`.
  - `Route` agrupa la configuración de URLs por idioma, las expresiones de routing y la lógica de ejecución
    de handlers de petición (método `run<C, P>`).
  - `crearExactGET` es la función de conveniencia para crear rutas de URL exacta con método `GET`.
- **`route/README.md`** *(nuevo)* — documentación completa del módulo `route`.

---

## 2026.5.22+3 — [Jose]

### Changed

- **`server/http/config/dominio.ts`** — reemplazado `Array.prototype.includes` por
  `indexOf(...) === -1` al comprobar `subdominio.nombre` dentro de `habilitados`,
  para mantener compatibilidad con navegadores que no soportan `includes` sin polyfill.

---

## 2026.5.18+next — [Jose]

### Refactor

- **`server/http/request-context.ts`** *(nuevo)* — extraída `RequestContext`, clase
  inmutable que reúne toda la información de lectura de una `IncomingMessage`: método,
  URL, host, headers, idioma, IP cliente, query string, request id, dispositivo
  detectado y cuerpo POST. No depende del lado de respuesta.
- **`server/http/conexion.ts`** — `Conexion` deja de ser un agregado monolítico:
  ahora **compone** una `RequestContext` accesible como `conexion.request` y delega
  todas las propiedades de petición vía getters/setters. La superficie de la clase
  se reduce de ~445 a ~310 LOC y queda concentrada en lo realmente suyo: estado
  CORS, máquina de estados (`iniciado/preparando/transfiriendo/terminado`), tracing
  (`getSpan`/`setRoute`) y los helpers estáticos legacy.
  - API pública 100% compatible: handlers existentes (`conexion.metodo`,
    `conexion.url`, `conexion.dominio`, `conexion.idioma`, `conexion.post = …`,
    `conexion.files = …`, `conexion.getQuery()`, `conexion.checkETag()`, etc.)
    siguen funcionando sin cambios; los setters de `post`/`postRAW`/`files` que usa
    `server.ts` también.
  - Primer paso de la separación de responsabilidades planteada para `Conexion`/
    `Respuesta`. Próximas fases (opcionales): `HeaderBuilder`, `ResponseLifecycle`
    y `ResponseSender`.

---

## 2026.5.18+next — [Jose]

### Security

- **`services/www-estaticos/modules/net/handlers/assets.ts`** — aplicado
  `assertSafePath()` en los handlers que construyen rutas del **filesystem local**
  a partir de segmentos capturados por matchers `prefix:` sin regex que limite el
  charset. Handlers afectados:
  - `/.well-known/atproto-did/{pais}` → `assertSafePath("assets/.well-known/atproto-did", pais)`
  - `/.well-known/{filename}` → `assertSafePath("assets/.well-known", filename)`

  Sin esta validación, un cliente podía emitir `GET /.well-known/..%2F..%2Fmrpack.json`
  y leer ficheros arbitrarios del pod (claves TLS en `files/ssl/`, configs con
  credenciales, etc.). El handler ahora responde `400 Bad request` cuando se detecta
  path traversal (`UnsafePathError`).

  Los handlers de `resources.ts` (`/js/...` y `/css/...`) **no** requieren esta
  validación: `Javascript.get` / `Css.get` resuelven el segmento contra un bucket
  de Google Cloud Storage (no contra disco local), y un `..` dentro del object name
  no produce traversal — el peor caso es un 404 de GCS.

### Changed

- **`server/http/respuesta.ts`** — `sendDataCompress()` reescrito a **streaming**:
  - Antes: `await zlib.brotliCompress(buffer)` materializaba el resultado completo
    en RAM antes de empezar a escribir al socket (TTFB esperaba a tener todo
    comprimido; pico de memoria = original + comprimido).
  - Ahora: `pipeline(buffer2stream(data), zlib.createBrotliCompress(), this.respuesta)`
    fluye los chunks del buffer al compresor al socket sin materializar la salida
    completa. Mejora TTFB y reduce memoria para respuestas grandes.
  - Se envía con `Transfer-Encoding: chunked` (no se fija `Content-Length` porque
    el tamaño comprimido se desconoce hasta terminar el stream).
  - HEAD: descarta el compresor y cierra la respuesta sin cuerpo (RFC 9110 §9.3.2).
- **`server/http/config/net.ts`** — JSDoc de `INet.compress` ampliado documentando que
  **debe permanecer desactivado en producción** (CloudFlare comprime en el edge y
  Envoy/ASM puede hacerlo en el sidecar). El único caso de uso legítimo es el
  proyecto `proxy` de desarrollo local, sin CloudFlare ni ASM delante.

---

## 2026.5.18+next — [Jose]

### Added

- **`server/http/conexion.ts`** — nuevos métodos para integración con tracing:
  - `getSpan()` — devuelve el span de `dd-trace` activo (auto-instrumentado por el
    plugin HTTP) o `null` si no hay tracer cargado. Los handlers pueden usarlo para
    añadir tags propios o crear spans hijo.
  - `setRoute(resumen)` — renombra el span activo asignando `resource.name = "<MÉTODO> <resumen>"`
    y `http.route = <resumen>`, de modo que Datadog agrupe trazas por patrón de ruta
    en lugar de por URL concreta.
- **`server/http/routes/group/block.ts`** — `RouteGroupBlock.check()` invoca
  `conexion.setRoute(expresion.resumen)` automáticamente al producirse el match.

> **Nota sobre access logs**: no se emite un log por petición desde la aplicación.
> Envoy (sidecar de Istio/ASM) ya produce access logs estructurados con
> `method`/`path`/`status`/`latency`/`request_id`/`ip`/`user_agent`, por lo que
> duplicarlo en Node solo doblaría coste de ingesta en Cloud Logging/Datadog sin
> aportar información nueva.

### Changed

- **`server/http/error.ts`** — refactor de la jerarquía `HttpError`:
  - Nueva clase intermedia `HttpErrorMensaje` que centraliza `message`/`extra`/`sendRespuesta()`.
  - `HttpError404`, `HttpError410` y `HttpError500` extienden de `HttpErrorMensaje`
    directamente, cada uno con su constructor de status fijo. Se elimina el
    anti-patrón Liskov por el que `HttpError410`/`HttpError500` extendían de `HttpError404`
    (subtipos con la misma firma pero semántica distinta).
  - Constructores simplificados: ya no aceptan `status` por parámetro.

---

## 2026.5.18+next — [Jose]

### Added

- **`server/http/config/net.ts`** — nuevos campos en `INet`/`Net` con defaults adaptados a
  ejecución en GKE detrás de Istio/ASM:
  - `maxRequestBodySize` (10 MB) — tope global del cuerpo de petición para `POST`/`PUT`/`PATCH`/`DELETE`.
  - `trustProxy` (`PRODUCCION`) — habilita el uso de `X-Forwarded-For`, `X-Forwarded-Proto`
    y `X-Forwarded-Host` para resolver IP cliente, esquema y host reales.
  - `keepAliveTimeout` (75 s) y `headersTimeout` (80 s) — coherentes con el keepalive típico de Envoy.
  - `shutdownTimeout` (25 s en producción, 2 s en desarrollo) — tiempo máximo de drenado
    antes de forzar cierre. En dev se usa un valor bajo para que `mrpack` perciba el
    reinicio del servicio como instantáneo.
- **`server/http/server.ts`** — `Server.close(timeoutMs)` para shutdown graceful de HTTP y HTTPS:
  `server.close()` + `closeAllConnections()` tras el timeout. Listeners automáticos en `SIGTERM`/`SIGINT`.
  Nuevo `Server.isShuttingDown()`.
- **`server/http/server.ts`** — tras drenar (o si el drenado supera `2 × shutdownTimeout`)
  el proceso llama explícitamente a `process.exit()`. Esto evita que el proceso se quede
  colgado tras registrar el listener de señal (que anula el comportamiento por defecto de
  Node de terminar al recibir `SIGTERM`).
- **`server/http/routes/group/block.ts`** — `RouteGroupBlock` mantiene ahora un índice
  `expresionesPorMetodo: Map<TMetodo, Checker[]>` con un bucket ordenado por método HTTP.
  Cada bucket es un subconjunto de `expresiones` que preserva el **orden original**
  (crítico para mantener la semántica "primer match gana"). Acelera el matching cuando
  el bloque tiene rutas para varios métodos.
- **`server/http/checkers/index.ts`** — `Checker.matchSinMetodo(data)` devuelve los
  métodos aceptados por la expresión para una URL/dominio/idioma/query ignorando el método
  entrante. Lo usan los nuevos `collectAllowedMethods` en `RouteGroupBlock`, `RouteGroup`
  y `Routes`.
- **`server/http/router.ts`** — el router responde `405 Method Not Allowed` con cabecera
  `Allow:` (alfabéticamente ordenada) cuando ninguna ruta hace match con el método entrante
  pero la URL **sí** está registrada para otros métodos. Si no hay candidatos, cae al
  handler genérico de `404` como antes.
- **`server/http/respuesta.ts`** — nuevas semánticas para peticiones `HEAD`: `responder()`,
  `sendCache()`, `sendStream()` y `forwardIncomingConnection()` construyen las cabeceras
  igual que para `GET` pero **omiten el cuerpo** (RFC 9110 §9.3.2). `Conexion` implementa
  el nuevo hook `isHead()` a partir del método HTTP.
- **`server/http/respuesta.ts`** — `enviarCabeceras()` añade por defecto
  `X-Content-Type-Options: nosniff` en todas las respuestas para prevenir MIME-sniffing.

### Changed

- **`server/http/checkers/index.ts`** — `Checker` ya no muta los arrays `metodos` ni
  `dominios` del `IExpresion` recibido. Antes los modificaba in-place al añadir `HEAD`
  y `OPTIONS`, lo que provocaba acumulación si el mismo `IExpresion` se reutilizaba.
- **`server/http/router.ts`** — eliminado `PromiseDelayed()` al inicio de `route()`.
  Añadía latencia innecesaria a cada petición sin aportar valor observable.
- **`server/http/server.ts`** — `iniciarHTTPs()` registra un error y devuelve un
  `Promise.reject` en `PRODUCCION`. TLS lo termina Istio/ASM, por lo que ejecutar un
  servidor HTTPS dentro del pod duplica handshakes y consumo de memoria sin sentido.
  Sigue disponible para uso local en desarrollo.
- **`server/http/metrics.ts`** (nuevo) — singleton `metricas` con un mini-recolector
  Prometheus sin dependencias externas. Expone `http_requests_total`,
  `http_request_errors_total`, `http_request_duration_ms` (histograma con buckets
  5 ms…10 s) y `http_process_uptime_seconds`. Si en el futuro hacen falta labels
  arbitrarios o summaries, conviene migrar a `prom-client`.
- **`server/http/handlers/admin.ts`** — nuevo endpoint
  `GET /admin/metrics/` que sirve la exposición text de Prometheus
  (`Content-Type: text/plain; version=0.0.4; charset=utf-8`) con cabeceras de no-cache.
- **`server/http/server.ts`** — registra automáticamente la métrica de cada petición
  (`metricas.observe(method, status, durationMs)`) vía `response.on("finish"|"close")`.
- **`server/http/utiles/path.ts`** (nuevo) — helper `assertSafePath(basedir, requested)`
  que valida que una ruta de fichero queda dentro del directorio base, evitando
  path-traversal. Lanza `UnsafePathError` si escapa.
- **`server/http/server.ts` y `server/http/conexion.ts`** — todas las llamadas a
  `qs.parse` usan ahora opciones endurecidas: `depth: 5`, `parameterLimit: 1000`,
  `arrayLimit: 200`, `allowPrototypes: false`. Mitiga prototype-pollution y DoS por
  payloads excesivamente anidados.
- **`server/http/respuesta.ts`** — `enviarCabeceras()` aplica por defecto
  `Referrer-Policy: strict-origin-when-cross-origin` en respuestas con `Content-Type`
  `text/html`, salvo que el handler haya definido uno explícitamente. No se añade
  para APIs/imágenes para no afectar a la compatibilidad de clientes.
- **`server/http/routes/group/block.ts`** — `parseExpresiones` emite un `warning` cuando
  una `IExpresion` define varios matchers (`regex`/`exact`/`prefix`/`comodin`) — antes
  solo se usaba el primero por prioridad **silenciosamente** — o cuando no define ninguno.
  La combinación `regex + prefix` **no** se considera conflicto: en ese caso `prefix`
  actúa como guard rápido previo a la evaluación de la regex
  (ver `checkers/regex.ts`).
- **`server/http/conexion.ts`** — `Conexion.clientIp` (IP real cliente respetando `trustProxy`) y
  `Conexion.requestId` (uuid v4 generado o reutilizado de `X-Request-Id`). El `requestId` se propaga
  automáticamente al cliente como cabecera `X-Request-Id`. `Conexion.dominio` ahora respeta
  `X-Forwarded-Host` cuando `trustProxy` es `true`.
- **`server/http/handlers/admin.ts`** — `/admin/ready/` devuelve `503` mientras
  `Server.isShuttingDown()` es `true`, para que GKE/Istio detenga el tráfico nuevo durante el drain.

### Changed

- **`server/http/server.ts`** — el body parsing acepta ahora `POST`, `PUT`, `PATCH` **y** `DELETE`,
  aplica el tope `maxRequestBodySize` (responde `413` si se supera) y deja de usar `setImmediate`
  por petición. La detección de `https` solo confía en `X-Forwarded-Proto` cuando `trustProxy` es `true`.
- **`server/http/server.ts`** — listener `clientError` que responde `400` y cierra el socket en lugar
  de dejar la conexión colgada.
- **`server/http/respuesta.ts`** — `forwardIncomingConnection` ahora filtra las cabeceras hop-by-hop
  (`Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailer`,
  `Transfer-Encoding`, `Upgrade`) y las extras listadas por `Connection`, para evitar request/response
  smuggling al reenviar respuestas upstream.
- **`server/http/respuesta.ts`** — `config` pasa de `private` a `protected readonly` para que
  `Conexion` pueda consultar `trustProxy` y otros parámetros.
- **`server/http/respuesta.ts`** — eliminados los estáticos mutables
  `Respuesta.SERVICE/POD/ZONA/VERSION`. Se sustituyen por `IRespuestaContext` inyectado
  por instancia y por `Respuesta.setContextoDefecto(...)` para inicializar el contexto
  global del proceso de forma controlada e inmutable.
- **`server/http/conexion.ts`** — el constructor acepta opcionalmente `IRespuestaContext`
  y lo propaga a la base `Respuesta`.
- **`server/http/router.ts`** — `route()` ya no silencia con `.catch(() => false)` las excepciones
  del routing; las loguea con `error()` antes de delegar en el handler de error.
- **`server/http/routes/group/block.ts`** — eliminado el flag `errorLogged` que silenciaba todos
  los errores posteriores de un handler tras el primero. Ahora **cada** error se loguea.
- **`server/http/handlers/error.ts`** — el handler 500 ya **no expone** el parámetro `extra` al
  cliente en producción para evitar filtrar trazas o datos internos; en desarrollo se sigue
  incluyendo para facilitar la depuración.

---

## 2026.5.12+2 — [@bixus](https://github.com/bixus)

### Changed

- **`server/http/i18n/net.ts` → `server/http/i18n.ts`** — la clase `Idioma` (detección
  de idioma por path de URL) se ha extraído de `i18n/net.ts` a `i18n.ts`, directamente
  bajo `server/http/`.
  La entrada de importación cambia de
  `@mr/core-network/server/http/i18n/net` a
  `@mr/core-network/server/http/i18n`.

### Removed

- **`server/http/i18n/` — directorio eliminado** — el directorio `i18n/` que contenía
  `index.ts` (tipos `IdiomaCorto`, `IdiomaLargo`, `Idioma`, `soportados`, `soportado`,
  `corto`) y `net.ts` (clase `Idioma`) ha sido eliminado.
  Los tipos e utilidades de idioma ahora se importan directamente desde el paquete
  compartido `@mr/core-i18n/langs`; la clase `Idioma` se importa desde el nuevo
  `@mr/core-network/server/http/i18n`.

---

## 2026.5.12+1 — [@bixus](https://github.com/bixus)

### Added

- **`server/http/README.md` — documentación completa del módulo** — el README anterior
  solo cubría `config/device.ts`, `config/dominio.ts` y `config/net.ts`. Ahora documenta
  los 19 módulos del directorio:
  `server`, `conexion`, `respuesta`, `router`, `routes`, `routes/group`, `routes/group/block`,
  `checkers` (con los 4 matchers), `checkers/query` (con los 5 validadores), `error`,
  `i18n`, `i18n/net`, `schema/spec`, `schema/spec-to-type`, `schema/validation/backend`,
  `config/config`, `service`, `handlers/admin`, `handlers/error`, `handlers/favicon`.
  Incluye ejemplos de uso, tablas de propiedades/métodos y descripción del ciclo de vida
  de la conexión.

- **`RouteGroup.getWSHandlers()` — integración WebSocket** — el método sobreescribible
  `getWSHandlers(): IWSHandler[]` de `RouteGroup` permite registrar handlers WebSocket
  desde el mismo grupo que gestiona las rutas HTTP. Cuando algún grupo devuelve handlers
  no vacíos, el servidor WebSocket (`server/websocket`) se inicia automáticamente.
  Consulta [`server/websocket/README.md`](./server/websocket/README.md) para la
  documentación del protocolo.

### Changed

- **`server/http/respuesta.ts`** — revisión y mejoras:
  - `==`/`!=` → `===`/`!==` en todos los guards (`isOK`, `setContentTypeHTML`, `sendData`,
    `sendCache`, `responder`, `error`).
  - `extra?: any` → `extra?: unknown` en los dos overloads de `error()`.
  - `private static CHUNK_SIZE` → `private static readonly CHUNK_SIZE`.
  - `addCustomHeader`: `!this.responseHeaders[header]` → `!(header in this.responseHeaders)`
    para no fallar cuando el valor existente es `0` o `false`.
  - `write()` reescrito con bucle `while` en lugar de recursión con closure;
    `data.slice()` → `data.subarray()` (sin copia del buffer).
  - `forwardIncommingConnection` (typo) → `forwardIncomingConnection`.
  - `enviarCabeceras()`: eliminado todo el código comentado; lógica de `Expires`
    extraída a variable `expired` para evitar la repetición de `new Date(Date.now() - 3_600_000)`.
  - JSDoc completo en clase, enum `TReferrerPolicy` y todos los métodos.

- **`server/http/conexion.ts`** — revisión y mejoras:
  - `import {IErrorHandler}` → `import type {IErrorHandler}`.
  - Imports reordenados según convención del workspace.
  - `==`/`!=` → `===`/`!==` en guards de estado y comparaciones de headers.
  - `peticion.connection.remoteAddress` → `peticion.socket.remoteAddress`
    (`connection` está deprecated desde Node.js 13.0.0).
  - `this.get.indexOf("/web")===0` → `this.get.startsWith("/web")`.
  - `!this.https?"http":"https"` → `this.https ? "https" : "http"`.
  - `post?: NodeJS.Dict<any>` → `NodeJS.Dict<unknown>`.
  - `getQuery<T=any>()` → `getQuery<T=unknown>()`.
  - `_device` inicializado en el constructor (`this._device = undefined`).
  - `buildRespuesta`: `if (!expiracion) {...}` → `expiracion ??= new Date()`.
  - Regex de detección de dispositivo: eliminados outer `(?:...)` innecesarios y
    el escape redundante `\ ` en `opera mini`.
  - Código comentado eliminado del constructor y `detectarDevice()`.
  - JSDoc completo en clase, enum `TStatus` y todos los métodos.

- **`server/http/server.ts`** — revisión y mejoras:
  - Imports reordenados (destructuring antes de defaults).
  - `this.serverHTTP==null` / `this.serverHTTPS==null` → `=== null`.
  - `request_handlers` (snake_case) → `requestHandlers`.
  - `SNICallback` simplificado: if/else sobre `ctx === undefined` →
    `cb(null, contextos.get(servername))`.
  - Variable local `querystring: string[]` → `parts` (evita confusión con el módulo Node.js).
  - Código comentado eliminado.
  - JSDoc completo en clase y métodos.

- **`server/http/handlers/error.ts`** — `class Error` → `class HttpErrorHandler`
  para evitar la colisión con el global `Error` de JavaScript/TypeScript;
  `import {Conexion}` → `import type {Conexion}`; `extra?: any` → `extra?: unknown`;
  factory tipada explícitamente; JSDoc.

- **`server/http/handlers/admin.ts`** — `import {EngineServer}` →
  `import type {EngineServer}`; variable `doc` declarada pero no usada en `/admin/doc/`
  integrada directamente en `sendRespuesta`; guard `err instanceof Error` en los `.catch`;
  factory tipada; JSDoc.

- **`server/http/handlers/favicon.ts`** — template literals sin interpolación →
  comillas dobles; factory tipada; JSDoc.

- **`server/http/service.ts`** — `hash.substring(0, 8)` → `hash.slice(0, 8)`.

- **`server/http/config/dominio.ts`** — `scheme: \`https\`` (×2 en statics) →
  `"https"`; espacios alrededor de `??` en `get()`.

- **`server/http/checkers/query/exact.ts`, `options.ts`, `prefix.ts`, `cualquiera.ts`** —
  parámetros de constructor `private` → `private readonly`;
  `param.length>=this.longitud` → con espacios.

- **Eliminación de `/* STATIC */` y `/* INSTANCE */`** — eliminados de forma
  consistente en todos los ficheros del módulo `server/http`.

---

## 2026.5.11+6 — [@bixus](https://github.com/bixus)

### Changed

- **`client/websocket/message.ts` → `metadata/websocket/message.ts`** — las interfaces del
  protocolo WebSocket (`IMessageClient`, `IMessageServerOK`, `IMessageServerKO`, `IMetadata`,
  `MessageServer`, `IStreamFrame`) se han extraído de `client/websocket/` a un nuevo directorio
  `metadata/websocket/` ya que son compartidas por el cliente y el servidor.
  La entrada de importación cambia de `@mr/core-network/client/websocket/message` a
  `@mr/core-network/metadata/websocket/message`.
  Creados `metadata/README.md` y `metadata/websocket/README.md`.

---

## 2026.5.11+5 — [@bixus](https://github.com/bixus)

### Changed

- **`http/config/` → `server/http/config/`** — el directorio `http/` (con `config/device.ts`,
  que exporta el enum `TDevice`) se ha movido bajo `server/` para agrupar toda la
  funcionalidad de servidor en un único directorio.
  La entrada de importación cambia de `@mr/core-network/http/config/device` a
  `@mr/core-network/server/http/config/device`.
  Creados `server/README.md` y `server/http/README.md` con la documentación del módulo.

---

## 2026.5.11+4 — [@bixus](https://github.com/bixus)

### Changed

- **`websocket/server/` → `server/websocket/`** — la implementación del servidor WebSocket
  (`handler.ts`, `index.ts`) se ha movido a `server/websocket/` para simetría con el cliente
  en `client/websocket/`.
  Las entradas de importación cambian:
  - `@mr/core-network/websocket/server` → `@mr/core-network/server/websocket`
  - `@mr/core-network/websocket/server/handler` → `@mr/core-network/server/websocket/handler`
  El directorio `websocket/` ha sido eliminado.

---

## 2026.5.11+3 — [@bixus](https://github.com/bixus)

### Changed

- **`websocket/client/` → `client/websocket/`** — el cliente WebSocket (pool, result, error y
  las interfaces del protocolo) se ha extraído de `websocket/` y reubicado bajo el directorio
  `client/`, junto al resto de utilidades de cliente de red.
  Las entradas de importación cambian:
  - `@mr/core-network/websocket/client` → `@mr/core-network/client/websocket`
  - `@mr/core-network/websocket/client/result` → `@mr/core-network/client/websocket/result`
  - `@mr/core-network/websocket/message` → `@mr/core-network/client/websocket/message`
  El directorio `websocket/` conserva únicamente la implementación de servidor (`server/`).

- **`request/` → `client/`** — el directorio `request/` ha sido renombrado a `client/` para
  reflejar su propósito ampliado (ya no solo HTTP, también WebSocket).
  Las entradas de importación cambian de `@mr/core-network/request/…` a `@mr/core-network/client/…`.

---

## 2026.5.11+2 — [@bixus](https://github.com/bixus)

### Changed

- **`client/` — reorganización en subdirectorio `http/`** — los ficheros de protocolo HTTP
  (`interface.ts`, `error.ts`, `respuesta.ts`), los parsers (`parser/`) y las clases de
  petición (`peticion/`) se han movido a `client/http/` para separar las utilidades
  genéricas del módulo (`factory.ts`, `ua.ts`) de los tipos y clases específicos de HTTP.
  Las entradas de importación cambian de `@mr/core-network/client/…` a
  `@mr/core-network/client/http/…` para los ficheros movidos.
  Creado [`client/http/README.md`](./client/http/README.md) con la documentación completa
  del subdirectorio.

---

## 2026.5.11+1 — [@bixus](https://github.com/bixus)

### Changed

- **`client/ua.ts` — lista de User-Agents renovada** — eliminadas 51 entradas de 2017–2020
  (Chrome ≤ 85, IE 6/7/9, dos entradas con tabulador artefacto y una entrada `CK={}` malformada).
  Sustituidas por 41 UAs modernos de 2024–2025: Chrome 124–130 (Windows/macOS/Linux),
  Firefox 124–128, Safari 17.4–18.1 (macOS/iOS), Edge 124–130, Chrome Android 124–128,
  Samsung Internet 23–24.
  `UA` declarado `readonly`; `UA_LENGTH` eliminado; JSDoc añadido a `randomUA()`.

---
## 2026.5.5+1 — [@bixus](https://github.com/bixus)

### Added

- **`WSPool.head<T>(method, params?)`** — nuevo método fire-and-forget que envía un mensaje al
  servidor sin esperar ninguna respuesta. La conexión vuelve al pool en el `finally` del propio
  método, permitiendo que otras peticiones la reutilicen inmediatamente.
  Útil para notificaciones, invalidaciones de caché o cualquier acción donde el resultado no
  interesa al llamador.

- **`IMessageClient.head?: boolean`** — nuevo campo opcional en el protocolo. Cuando es `true`,
  el servidor ejecuta el handler normalmente pero silencia todas las llamadas a
  `WSHandler.sendRespuesta()` y `WSHandler.sendError()` (no-op), evitando que el handler
  envíe datos a un cliente que no los va a consumir.

- **`WSHandler.head` (5º parámetro del constructor)** — booleano que activa el modo silencioso
  en `sendRespuesta` y `sendError`. Se pasa automáticamente desde `handleRequest` a través de
  `data.head`; los implementadores de `IWSHandler` no necesitan ser conscientes de este campo.

---
## 2026.4.30+5 — [@bixus](https://github.com/bixus)

### Fixed

- **`InvalidAccessError: invalid code` al cerrar conexiones** — `deleteConnectionFinal`
  pasaba el código de cierre original del evento WebSocket (`event.code`) a `ws.close()`.
  Cuando el servidor reinicia abruptamente, el código puede ser `1005` (no status received)
  o `1006` (abnormal closure): ambos son reservados para uso interno del estándar y
  lanzan `InvalidAccessError` si se pasan a `ws.close()`, matando el proceso.
  Fix: se usa siempre `1000` al cerrar el socket desde el pool, y se comprueba
  `readyState < WebSocket.CLOSING` antes de llamar a `close()` para no invocarla sobre
  un socket que ya está cerrado (como ocurre en el `closeHandler`).

---
## 2026.4.30+4 — [@bixus](https://github.com/bixus)

### Fixed

- **Conexiones zombie tras reinicio del servidor** — `deleteConnection()` tenía un bug:
  cuando el servidor estaba caído, `addConnection()` fallaba y el `.catch(()=>undefined)`
  silenciaba el error **sin llamar a `deleteConnectionFinal`**. La conexión cerrada
  permanecía en `available`, y la siguiente petición la obtenía del pool creyéndola válida.
  Fix: eliminación inmediata (`deleteConnectionFinal` primero) seguida de intento de
  reposición asíncrono (fire-and-forget). El pool puede quedar momentáneamente por debajo
  de `minConnections`, pero `getConnection()` crea conexiones bajo demanda si es necesario.

---
## 2026.4.30+3 — [@bixus](https://github.com/bixus)

### Fixed

- **Reconexión persistente durante reinicio del servidor** — cuando la stream cae y el
  servidor aún no ha levantado, el único intento de `getConnection()` fallaba con un error
  genérico que salía silenciosamente de `stream()` sin reintentar ni abrir el circuito.
  Ahora el tramo de reconexión usa un **bucle con backoff exponencial** (`Promise.race`
  con `requestTimeoutDeferred`) que sigue probando `getConnection()` mientras el timeout
  global no se agote: 100 ms → 200 ms → 400 ms → … → `RECONNECT_MAX_MS` entre intentos.
  El servidor puede tardar hasta `requestTimeoutMs` (30 s por defecto) en responder antes
  de que la petición se cancele con timeout.

---
## 2026.4.30+2 — [@bixus](https://github.com/bixus)

### Fixed

- **Circuit breaker — sonda de fondo al abrir el circuito** — cuando el circuit breaker
  pasa a `Open` (tras `CIRCUIT_FAILURE_THRESHOLD` fallos consecutivos), ahora se inicia
  automáticamente una sonda de fondo (`startCircuitProbe`) que intenta establecer una
  conexión con backoff exponencial (`RECONNECT_BASE_MS × 2^intento`, tope
  `CIRCUIT_OPEN_DURATION_MS`). En cuanto el servidor responde, la conexión de prueba se
  añade al pool, el circuito pasa a `Closed` y las peticiones se reanudan sin esperar los
  30 segundos de `circuitOpenUntil`.
  Antes del fix, un reinicio del servidor dejaba el circuito bloqueado el tiempo completo
  aunque el servidor volviera en pocos segundos. El comportamiento anterior
  (`circuitOpenUntil` + `HalfOpen`) se mantiene como red de seguridad si los timers no
  disparan.

---
## 2026.4.30+1 — [@bixus](https://github.com/bixus)

### Changed

- **`Result.next()` — eliminado el overload con `Deferred`** — `next()` ahora solo acepta
  la firma sin parámetros y siempre devuelve `Promise<IResponse<T>>`.
  El overload `next(deferred)` era un anti-patrón junto a fallbacks HTTP: si la conexión se
  cortaba, el `Deferred` quedaba rechazado y el fallback ya no podía resolverlo.
  - Para fallback HTTP → usar `pipe(...deferreds)` (Deferreds quedan pendientes en error).
  - Para "rechaza el Deferred en error" sin fallback → usar `consume(generator.next(), deferred)`.

---
## 2026.4.29+8 — [@bixus](https://github.com/bixus)

### Added

- **`factoryCache<T>()` — caché genérica con expiración automática** — nueva función en
  `client/factory.ts` (entrada `@mr/core-network/client/factory`).
  Gestiona un mapa de caché compartido con semántica de deduplicación: peticiones
  concurrentes con la misma clave reciben la misma promesa en vuelo sin re-ejecutar `fn`.
  Al resolverse, programa automáticamente la eliminación de la entrada cuando los datos
  expiran (`expires - Date.now()`), o inmediatamente si `expires` ya ha pasado. El tiempo
  de carga se registra en el log solo en llamadas con *cache miss*.
  Exporta además `IFactoryCache<T>`, `IFactoryExpires<T>` e `IFactoryOptions<T>`.

### Removed

- **`Factory` / `IOptions` en `client/backend/factory.ts`** — clase base eliminada
  (código comentado). La inicialización del pool y la URL del servicio queda a cargo
  de cada backend concreto. El fichero se conserva vacío para no romper imports existentes.

---
## 2026.4.29+7 — [@bixus](https://github.com/bixus)

### Added

- **`Result.pipe(...deferreds)` — consumo paralelo con fallback HTTP** — nuevo método en la clase
  `Result` que consume N mensajes del generator (hasta 3, con overloads tipados independientes)
  resolviendo cada `Deferred<IResponse<T>>` en cuanto llega su mensaje, sin esperar al resto.
  A diferencia de `next(deferred)`, si un mensaje falla el `Deferred` **no se rechaza** — queda
  pendiente para que el llamador pueda resolverlo mediante un fallback HTTP. La promesa devuelta
  rechaza en cuanto cualquier mensaje falla, lo que permite encadenar `.catch()` para activar el
  fallback solo sobre los Deferreds que aún no estén liquidados.
  Útil en endpoints que devuelven múltiples respuestas independientes (p. ej. datos principales
  y alternativas de localización) y necesitan degradación transparente a HTTP.

---
## 2026.4.29+6 — [@bixus](https://github.com/bixus)

### Changed

- **`CircuitState` — estados del circuit breaker extraídos a `const enum`** — los string literals
  `"closed"`, `"open"` y `"half-open"` que controlaban el estado interno del circuit breaker han
  sido reemplazados por el `const enum CircuitState { Closed, Open, HalfOpen }` definido en
  `client/websocket/index.ts`. Los valores son inlined por el compilador TypeScript (sin overhead en
  runtime). `WSPool.getCircuitState()` devuelve ahora `CircuitState` en lugar de un string literal.
  Los consumidores que comparen el resultado con un string (`=== "open"`) siguen funcionando sin
  cambios gracias al valor del enum; los nuevos consumidores pueden usar `CircuitState.Open`.

---
## 2026.4.29+5 — [@bixus](https://github.com/bixus)

### Added

- **Shutdown graceful del servidor** — nuevo método público `WebSocket.shutdown(timeoutMs = 30000)`.
  Flujo: (1) marca el servidor como `draining` y cierra el `WebSocketServer` para no aceptar nuevas
  conexiones; (2) envía `"Shutdown"` a todos los clientes activos y les da `MAX_SHUTDOWN_MS` para cerrar
  limpiamente; (3) espera hasta `timeoutMs` a que `clientes.size === 0`; (4) fuerza `ws.terminate()`
  a los que no hayan cerrado; (5) elimina el singleton para que `createWSServer()` pueda reinicializar.
  Las nuevas conexiones recibidas durante el drenado se rechazan con código `1001`.

- **Circuit breaker en el cliente** — el pool ahora implementa el patrón circuit breaker por instancia.
  Tres estados: `"closed"` (normal), `"open"` (fail fast) y `"half-open"` (petición de prueba).
  Transición `closed → open` tras `CIRCUIT_FAILURE_THRESHOLD = 5` fallos de conexión consecutivos.
  Transición `open → half-open` tras `CIRCUIT_OPEN_DURATION_MS = 30000` ms. Si la prueba tiene éxito,
  vuelve a `closed`; si falla, regresa a `open`.
  Solo los errores de red (`WSConnectionError`) cuentan como fallo; los timeouts de petición no abren
  el circuito (el servidor está activo pero lento).
  Nuevo método `WSPool.getCircuitState()` para health checks.

---
## 2026.4.29+4 — [@bixus](https://github.com/bixus)

### Added

- **`IWSHandler.timeoutMs` — timeout configurable por handler** — nueva propiedad opcional en
  `IWSHandler`. Si se define, sobreescribe `HANDLER_TIMEOUT_MS` (30 s) para ese handler concreto.
  Útil para handlers que realizan operaciones costosas (generación de informes, procesado de imágenes,
  etc.) y necesitan más tiempo sin elevar el límite global de todos los handlers del servidor.
  El mensaje de error incluye el valor efectivo: `Handler timeout (120000ms) for method /informe/`.
  Los handlers existentes que no definan `timeoutMs` no requieren ningún cambio.

---
## 2026.4.29+3 — [@bixus](https://github.com/bixus)

### Added

- **Backoff exponencial con jitter en reconexión (cliente)** — entre reintentos de reconexión se espera
  un tiempo creciente: 100 ms, 200 ms, 400 ms… hasta un máximo de 5 s. Cada delay incluye un ruido
  aleatorio de ±20 % para evitar el efecto *thundering herd* cuando varios clientes reconectan a la vez
  contra un servidor en recuperación. Nuevas constantes `RECONNECT_BASE_MS = 100` y
  `RECONNECT_MAX_MS = 5000`.

- **Timeout por handler (servidor)** — nueva constante `HANDLER_TIMEOUT_MS = 30000` (30 s).
  Si un handler no completa en ese tiempo, el cliente recibe un error inmediato
  (`Handler timeout (30000ms) for method …`) y el slot de concurrencia se libera. El handler continúa
  ejecutándose en background; sus respuestas son descartadas por el cliente, que ya recibió el error.
  El error se registra como tag en el span Datadog del handler.

- **`WSPool.destroy()`** — libera todas las conexiones del pool, cancela el timer de reposición y
  elimina la instancia del registro global de singletons. Una llamada posterior a `WSPool.get()` con
  la misma configuración crea un pool nuevo desde cero. Acepta `code` y `reason` opcionales para el
  cierre WebSocket (por defecto `1000 / "Pool destroyed"`).

---
## 2026.4.29+2 — [@bixus](https://github.com/bixus)

### Added

- **Timeout global de petición (cliente)** — `IWSPoolConfig` acepta `requestTimeoutMs` (por defecto 30 s).
  Si la petición (incluidos reintentos de reconexión) no completa en ese tiempo, el generator lanza un error
  **sin intentar reconectar**: el servidor está activo pero lento; reconectar reenviaría la petición y podría
  causar operaciones duplicadas. El timer se cancela limpiamente en el `finally` exterior del generator,
  incluyendo el caso en que el consumidor interrumpe la iteración con `break` / `.return()`.

- **Heartbeat del lado cliente** — `IWSPoolConfig` acepta `heartbeatTimeoutMs` (por defecto 45 s).
  Si no se recibe ningún mensaje (incluyendo pings `Alive`) en ese intervalo, la conexión se considera muerta:
  se rechaza `abort.promise` para despertar cualquier stream activo y se elimina la conexión del pool.
  Cuando el heartbeat dispara sobre una conexión en uso (no en `available`), el socket se cierra
  correctamente en el bloque `finally` del generator (bug previo: socket leak).

- **Rate limiting por conexión (servidor)** — nueva constante `MAX_CONCURRENT_REQUESTS = 10`.
  Si un cliente supera el límite de handlers simultáneos, las peticiones adicionales se rechazan
  inmediatamente con `ok: false` sin llegar al handler. El contador `activeRequests` se decrementa
  en el `.finally()` de la cadena, tanto en éxito como en error.

- **Backpressure transparente en streaming (servidor)** — `WSHandler` ya no llama a `ws.send()`
  directamente. `sendRespuesta` y `sendError` encolan los frames en una cola FIFO interna (`outQueue`).
  Un `drainLoop` asíncrono los procesa en orden y espera automáticamente al evento `drain` del socket
  cuando `ws.bufferedAmount > 64 KB`, evitando que streams rápidos agoten la memoria del servidor.
  Los handlers existentes **no requieren ningún cambio**: el mecanismo es completamente transparente.

- **Singleton de servidor acumulador de handlers** — `createWSServer()` ya no descarta silenciosamente
  una segunda llamada. Si el servidor ya está inicializado, los nuevos handlers se añaden a la instancia
  existente mediante el nuevo método público `addHandlers(handlers: IWSHandler[])`. Permite una
  arquitectura modular en la que distintos módulos registran sus handlers de forma independiente.

- **Tabla de enrutamiento de handlers O(1) (servidor)** — la búsqueda de handler en `handleRequest`
  pasa de un bucle O(n) sobre un array a un lookup O(1) en un `Record<string, IWSHandler>`.
  Al registrar un `IWSHandler` con varios métodos, cada método obtiene su propia entrada en el índice.
  Si un método se registra dos veces, el último handler sobrescribe al anterior.

### Fixed

- **Socket leak en heartbeat sobre conexión en uso** — cuando el heartbeat timeout disparaba sobre
  una conexión activa (no en `available`), `deleteConnectionFinal` no llamaba a `ws.close()` porque
  la conexión no estaba en el array `available`. El bloque `finally` del generator ahora cierra el
  socket si `conexion.eol > 0`, cubriendo este caso.

- **Timeout disparaba reconexión** — cuando `requestTimeoutPromise` rechazaba con `reconnect === true`,
  el catch marcaba `shouldReconnect = true`, lo que reenviaba la petición a una conexión nueva y podía
  causar duplicados en el servidor. El timeout ahora siempre produce un `dropError` definitivo,
  independientemente del flag `reconnect`.

- **Clave de singleton con `reconnect` incorrecta** — `WSPool.get({ socket })` (sin `reconnect`)
  producía la misma clave que `WSPool.get({ socket, reconnect: false })`, devolviendo la misma instancia
  aunque el pool creado tenía `reconnect: true`. La clave ahora normaliza `undefined` como `true`:
  `cfg.reconnect !== false`.

- **`IMessageServerKO.info.extra` tipado como `any`** — corregido a `unknown` para alinearse con la
  convención del workspace (sin `any` explícito).

- **Mensajes de control sin `done`** — `MESSAGE_CONNECTION` y `MESSAGE_LIVENESS` se construían como
  `IMessageServerOK` sin el campo `done` requerido por el protocolo. Añadido `done: false` a ambos.
  No tenía impacto funcional (el cliente los ignora al carecer de `id`) pero era incorrecto.

---
## 2026.4.29+1 — [@bixus](https://github.com/bixus)

### Fixed

- **Guard `ArrayBuffer` en `initConnection`** — el `messageHandler` de control ahora descarta
  explícitamente los frames binarios (`instanceof ArrayBuffer`) antes de intentar parsearlos como JSON.
  Anteriormente, un frame binario provocaba que `JSON.parse` lanzase un `SyntaxError` silenciado por el
  `catch`, lo que funcionaba por accidente pero podía enmascarar errores futuros.

- **Silenciar logs de error en reconexiones** — cuando `reconnect === true`, el `errorHandler` de la conexión
  ahora silencia los logs de eventos `error`. Estos eventos (típicos en cortes abruptos, p. ej. POD del servidor caído)
  son capturados y manejados por el mecanismo de reconexión automática en el generator; registrarlos en el logger
  genera ruido innecesario. Si `reconnect === false`, el error se sigue loguando previo a propagar la excepción.

---
## 2026.4.28+1 — [@bixus](https://github.com/bixus)

### Added

- **Soporte a frames binarios** — el protocolo WebSocket ahora soporta el envío y recepción de `ArrayBuffer`.
  - **Servidor:** `sendRespuesta` acepta `IHandlerRespuesta<T>` (`{ data: T; buffer?: ArrayBuffer }`); cuando `buffer` tiene valor, envía el mensaje JSON con `buffer: true` seguido del frame binario como mensaje separado.
  - **Cliente:** el generator produce `IStreamFrame` (`{ message, buffer? }`); cuando el servidor anuncia `buffer: true`, el cliente espera el frame binario antes de ceder el frame completo al consumidor.
  - `ws.binaryType = "arraybuffer"` configurado automáticamente en cada conexión del pool.
  - `IMessageServerOK.data` ahora es opcional (`data?: T`) para reflejar que puede omitirse cuando la respuesta es exclusivamente binaria.
  - Nuevo tipo `IStreamFrame` en `message.ts`: par `{ message: MessageServer; buffer?: ArrayBuffer }` que el generator emite por cada respuesta del servidor.

- **Reconexión automática** (`reconnect`, por defecto `true`) — cuando la conexión WebSocket cae de forma inesperada mientras una petición está en curso, el generator descarta los frames pendientes y reenvía la petición automáticamente en una conexión nueva, sin intervención del consumidor.
  - Límite de **3 reconexiones consecutivas sin progreso** para evitar bucles infinitos con el servidor caído; el contador se reinicia con cada frame entregado.
  - La primera conexión se sigue obteniendo en `get()` (`async`): si el servidor está caído, la promesa se rechaza antes de crear el generator.
  - Con `reconnect: false` el error se propaga al consumidor en el primer fallo.

### Changed

- `WSPool.get()` ya no es `async` (devuelve `Result` directamente en lugar de `Promise<Result>`); el código existente que usa `await pool.get(...)` sigue funcionando sin cambios.
- La obtención de conexión se mueve de `get()` a `stream()`, permitiendo que el generator la gestione internamente en cada intento.
- `IHandlerRespuesta<T>` simplificada a `{ data: T; buffer?: ArrayBuffer }` — un único tipo en lugar de la unión `IHandlerRespuestaData | IHandlerRespuestaBuffer`.

---
## 2025.4.27+1 — [@bixus](https://github.com/bixus)

### Added

- **WebSocket cliente/servidor** — estreno oficial del módulo de comunicación WebSocket.
  Consulta [`websocket/README.md`](./websocket/README.md) para la documentación completa.
  - `WSPool` — pool de conexiones reutilizables con reconexión automática, liveness y propagación de traza Datadog.
  - `Result` — encapsula el `AsyncGenerator` de respuestas y expone `next()` y `consume()` para consumo tipado.
  - Servidor singleton con soporte para handlers (`IWSHandler`), streaming, frames binarios y shutdown graceful.
  - Propagación de contexto Datadog entre cliente y servidor mediante el campo `_datadog` del protocolo.
  - Enum `EWSControlMessage` (`Ready`, `Alive`, `Shutdown`) para los mensajes de control del ciclo de vida.
