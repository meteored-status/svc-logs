# CODEMAP — `services-comun`

> Segmentado por bloques. Los bloques 5 y 6 (`database/`, `send-task-system/`) son subsistemas grandes y
> autocontenidos con README/CODEMAP propios; el resto se documenta aquí.
> No se documenta fichero a fichero de forma exhaustiva (~214 ficheros `.ts`/`.js` en total): se detallan
> los puntos de entrada y símbolos relevantes; los módulos menores llevan una tabla resumen de una línea.

---

## 1. Motor de ejecución (`modules/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `modules/engine_event.ts` | `EngineEvent<T>` |
| `modules/engine_server_task.ts` | `EngineServerTask<T>` |
| `modules/telemetry.ts` | (vacío / comentado — ver nota) |

### Símbolos

#### `EngineEvent<T extends Configuracion = Configuracion> extends Engine` (de `@mr/core-workload/engine`)

Patrón de engine para procesos **sin servidor HTTP** (workers de eventos, cronjobs, listeners). Sobreescribe
`init()` para implementar su propio ciclo de vida en lugar del HTTP de `@mr/core-workload/engine/server`:

```
EngineEvent<T>
  init()                    → arranca waitEventReady() → launchEventLive(); monta watcher
                               chokidar sobre files/tmp/admin/ (solo si el directorio existe)
                               shutdown.lock → this.abort(motivo) + this.shutdown()
  waitEventReady()           → sondea started() cada 1000ms hasta que resuelve; luego writeLockFile()
  launchEventLive()          → bucle cada 1000ms: ok() + writeLockFile() (heartbeat de vida del pod)
  writeLockFile()             → escribe files/tmp/run.lock con el timestamp actual
  started() → ok()            (hook, delega en ok())
  ok()                        (hook protegido, no-op en la base — sobreescribible)
  shutdown()                  (hook protegido, no-op en la base — sobreescribible)
```

**Depende de:** `@mr/core-workload/config` (`Configuracion`, solo tipo), `@mr/core-workload/engine`
(`Engine` base), `chokidar`, `./utiles/{fs,log,promise}`.

> Nótese la duplicación parcial con el watcher de `shutdown.lock` que ya implementa
> `@mr/core-workload/engine/server.ts` (`Engine` HTTP) — aquí se reimplementa porque `EngineEvent` extiende
> la `Engine` *base* (sin servidor HTTP), para procesos que no exponen `/admin/*`.

#### `EngineServerTask<T extends ConfiguracionNet = ConfiguracionNet> extends Engine` (de `@mr/core-workload/engine/server`)

Patrón de engine para servicios HTTP que además necesitan un **updater periódico de datos** en background
(polling de una fuente externa, recomputar caches, etc.):

```
EngineServerTask<T>
  protected constructor(configuracion, inicio)
  initCheckDatos(interval: number|null, solape=false)
                             → programa checkDatos() tras checkDatosDelay() ms; si interval!=null,
                               lo repite cada interval ms con setInterval
  checkDatos(solape=false)   → invoca checkDatosEjecutar(); evita solape salvo que solape=true
  protected abstract checkDatosDelay(): number
  protected abstract checkDatosEjecutar(): Promise<void>
```

**Depende de:** `@mr/core-workload/config/net` (`ConfiguracionNet`, solo tipo), `@mr/core-workload/engine/server`
(`Engine` HTTP), `./utiles/log`.

#### `modules/telemetry.ts`

Fichero íntegramente comentado (bootstrap de OpenTelemetry con `TraceExporter` de Google Cloud Trace y
`HttpInstrumentation`). No exporta nada activo actualmente; se conserva como plantilla/histórico. No usar
como entry point real — la trazabilidad activa del monorepo es Datadog (`dd-trace`), ver
`app.js` de cada servicio y `@mr/core-network/server/websocket`.

---

## 2. Configuración Next.js (raíz)

**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `next.config.js` | Factory `(buildDirs?) => NextConfig` — config base compartida: `distDir: "output"`, `poweredByHeader: false`, `reactStrictMode: true`, rewrite `/admin/:path*` → `/api/admin/:path*`, inyecta constantes globales (`DESARROLLO`, `TEST`, `PRODUCCION`, `ENTORNO`, `NEXTJS`) vía `webpack.DefinePlugin` y sustituye imports `node:*` por su forma sin prefijo. Si se le pasan `buildDirs`, calcula `generateBuildId` con un hash MD5 recursivo del contenido de esos directorios. |
| `next.config.deps.js` | Wrapper: `require("./next.config.base")` + spread de `custom`. **Nota:** `./next.config.base` no existe actualmente en este workspace — el fichero no tiene consumidores activos localizados (no se detectó ningún `require`/`import` de `services-comun/next.config.deps.js` desde dentro del propio workspace ni desde `services/panel-frontend`); parece código huérfano o pendiente de completar. No confundir con el patrón real: los servicios Next.js consumidores (p. ej. `services/panel-frontend/next.config.deps.js`) hacen `require('services-comun/next.config.js')` directamente, **no** `next.config.deps.js`. |

Ambos ficheros también se usan como **inputs de fingerprint** de versión de despliegue: `@mr/cli`
(`mrpack/clases/workspace/compilar.ts`, método `packNextJS`) los incluye en la lista de ficheros que
`checkVersionService` hashea para decidir si un servicio Next.js necesita nueva build.

---

## 3. Utilidades (`modules/utiles/`)

**~39 ficheros.** Sin `index.ts` agregador: cada consumidor importa el fichero concreto
(`services-comun/modules/utiles/<nombre>`). Los siguientes son el **núcleo** usado transversalmente
(incluido por `@mr/core-workload` y `@mr/core-network`):

| Fichero | Símbolos clave |
|---------|-----------------|
| `log.ts` | `info`, `warning`, `error`, `debug`, `time`/`timeEnd`, `formatMemoria`, `formatTiempo` — logging estándar del monorepo (sustituye a `console.log`, ver convención de estilo) |
| `promise.ts` | `Deferred<T>`, `PromiseDelayed`, `PromiseChain`, `PromiseChainWTB` (with throttle/batch), `PromiseTimeout`/`PromiseTimeoutError`, `PromiseAny`, `PromiseResult`, `PromiseMap` |
| `fs.ts` | `exists`, `isDir`, `isFile`(`Sync`), `mkdir`, `rename`, `rmdir`/`rmDirManual`, `safeWrite`(`Stream`/`StreamBuffer`), `readFileBuffer`/`readFileString`, `readJSON`(`Sync`), `md5Dir`/`md5File`, `freeSpace`, `findSubdirs` |
| `error.ts` | `CustomError` (abstract, base de todas las excepciones tipadas del monorepo) |
| `hash.ts` | `md5`, `sha512`, `sha256`, `IHash<T>` |
| `random.ts` | `random(chars)`, `valoresValidos(listado)` |
| `use-case.ts` | `UseCase<I,R>` (abstract) — patrón caso de uso con `IUseCase<R>` |
| `object.ts` | `mergeDeep`, `dynamicProperty`, `copyObject`, `immute`, `sortObjectKeys` |
| `array.ts` | `arrayEquals`, `unique`, `arrayChop` (particiona en bloques de tamaño fijo, usado por *bulk writers*) |
| `stream.ts` | `pipeline` (re-export de `pipelinePromise`), `buffer2stream`, `stream2buffer` |
| `idioma.ts` | `parseIdioma`, `isRTL` |
| `cloudflare.ts` | `cfCountry`, `cfIP` — cabeceras de Cloudflare sobre `Conexion` |
| `user-agent.ts` | `isBot(conexion)` (basado en `isbot`) |
| `checkJsonFile.ts` | `checkJsonFile<T>(filePath)` |

Utilidades de dominio específico (meteorología / geo / negocio):

| Fichero | Propósito |
|---------|-----------|
| `unidades.ts` | Enums y conversores de unidades meteorológicas: `TVelocidad`, `TPrecipitacion`, `TNieve`, `TPresion`, `TTemperatura`, `TDistancia` + `convertir*`/`redondear*` |
| `geopoint.ts` | `Coordenadas`, `ICoordenadas`, `Hemisferio`, `distanceKm`, `near`, `plain` — geometría geográfica |
| `geojson.ts` | `IGeoJSON<P>`, `IProperties`, `IGeometry` — tipos GeoJSON |
| `fecha.ts` | `Fecha` (clase), `TTimeUnit` |
| `colors.ts` | `Colors` |
| `img/spline.ts` (ver bloque 12) | — |

Utilidades de infraestructura menor:

| Fichero | Propósito |
|---------|-----------|
| `analytics.ts` / `analyticsV2.ts` | `GAnalytics4`, `GAnalytics4V2` — envío de eventos a Google Analytics 4 (servidor) |
| `mysql.ts`, `postgres.ts`, `alloydb.ts` | `export default db` — instancias legacy preconfiguradas de los drivers de `modules/database/*` (ver bloque `database/`) |
| `kubectl/` (`index.ts`, `pod.ts`, `process.ts`) | `Kubectl`, `Pod`/`IPod`, `spawn()` — invocación de `kubectl` como subproceso |
| `elastic/` (`index.ts`, `read.ts`, `bulk.ts`) | `searchAll`/`searchAllGenerator`/`searchAllFn`, instancias `default` preconfiguradas de `Elasticsearch`/`Bulk` (ver bloques `elasticsearch/`, `database/bulk`) |
| `script.ts` | `detect(text)` — detección de lenguaje/formato de script |
| `string.ts` | `strip_tags`, `fromEntities`/`toEntities`/`toEntitiesSVG`, `removeAccents`, `str_word_count`, `toUrl`, `capitalize`, `toStringID` |
| `xml.ts` / `xmlBuilder.ts` | `XMLBuilder`, `XMLNode` (dos implementaciones paralelas — ver nota) |
| `cpu.ts` | `Cpu implements Disposable`, `default CPU` — medición de uso de CPU (`pidusage`) |
| `map.ts` | `IMap<T>` |
| `tests/` | Fixtures/helpers de test de las propias utilidades |

> **Nota:** `xml.ts` y `xmlBuilder.ts` exportan símbolos con el mismo nombre (`XMLBuilder`, `XMLNode`) desde
> ficheros distintos — probable duplicado histórico; revisar cuál es el vigente antes de importar uno u
> otro en código nuevo.

**Usado por:** prácticamente todo el resto del workspace y por `@mr/core-workload` (`log`, `fs`, `hash`,
`random`, `promise`).

---

## 4. Red (`modules/net/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `net/cache/index.ts` | `NetCache` (abstract), `RequestCache` (abstract), `IRouteGroupCache`, `INetCache`/`INetCacheV1`, `IRequestCache`/`IRequestCacheV1` |
| `net/cache/disk.ts` | `NetCacheDisk`, `RequestCacheDisk` |
| `net/cache/memory.ts` | `NetCacheMemory` |
| `net/cache/redis.ts` | `NetCacheRedis` |
| `net/cache/valkey.ts` | `NetCacheValKey`, `RequestCacheValkey` |
| `net/cache/valkey/{defaultValkey,valkey}.ts` | `DefaultValkey`, `Valkey` |
| `net/request-backend.ts` | `BackendRequest`, `IRequest`, `IRequestConfig`, `IRequestConfigCache`, `RequestResponse<T>`, `IncomingMessage` |
| `net/request-frontend.ts` | `FrontendRequest`, `IRequest`, `IRequestConfig`, `RequestResponse<T>` |

### Símbolos

#### `NetCache` (abstract)

Caché de **respuesta HTTP saliente del servidor** (por ruta/conexión), usada por
`@mr/core-network/server/http`'s `RouteGroup` vía el `cfg.cache` que inyecta
`@mr/core-workload/engine/server` (`NetCacheDisk` por defecto):

```
NetCache
  check(conexion, cfg: IRouteGroupCache)  → Promise<number>   — valida metadata+expiración y envía vía conexion.sendCache()
  save(conexion, cfg)                     → Promise<void>      (abstract)
  loadMetadata/loadData(conexion, cfg)                         (abstract, protegidos)
```

Implementaciones: `NetCacheDisk` (fichero local), `NetCacheMemory` (proceso), `NetCacheRedis`,
`NetCacheValKey`.

#### `RequestCache` (abstract)

Análogo a `NetCache` pero para **respuestas de peticiones salientes** (cliente HTTP interno, ver
`net/request-backend.ts`/`request-frontend.ts`): `check(url)`, `save(url, data)`.
Implementaciones: `RequestCacheDisk`, `RequestCacheValkey`.

#### `BackendRequest` / `FrontendRequest`

Wrappers de petición HTTP salientes ligeros (independientes de `@mr/core-network/client/http`, que es la
capa moderna); `BackendRequest` para llamadas servidor→servidor, `FrontendRequest` para llamadas
navegador→servidor.

**Depende de:** `@mr/core-network/server/http/conexion` (`Conexion`, solo tipo), `@mr/core-workload/config`
(`Configuracion`, solo tipo, en `valkey.ts`/`redis.ts`), `@mr/core-workload/config/pod` (`IPodInfo`, solo
tipo).
**Usado por:** `@mr/core-workload/engine/server.ts` (`NetCache`, `NetCacheDisk` en `initWebServer`).

---

## 5. Base de datos (`modules/database/`)

**README/CODEMAP propios:** ver [`modules/database/README.md`](./modules/database/README.md) y
[`modules/database/CODEMAP.md`](./modules/database/CODEMAP.md).

Drivers de base de datos (MySQL, PostgreSQL, AlloyDB, Redis, ValKey), gestión de transacciones por driver
sobre un contrato común (`Transaction`/`TransactionManager`), *bulk writers*, paginación por *scroll*
(Elasticsearch) y transacciones sobre Google Cloud Storage.

---

## 6. Sistema de envíos (`modules/send-task-system/`)

**README/CODEMAP propios:** ver [`modules/send-task-system/README.md`](./modules/send-task-system/README.md)
y [`modules/send-task-system/CODEMAP.md`](./modules/send-task-system/CODEMAP.md).

Subsistema DAO-based de generación, envío, seguimiento (webhooks) y estadísticas de comunicaciones vía
SparkPost, con persistencia mixta MySQL (tareas programadas) + Elasticsearch (envíos/eventos/receptores) +
PubSub (cola de pendientes).

---

## 7. Mensajería (`modules/messages/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `messages/pubsub/index.ts` | `PubSub<T>` (v1, legacy) |
| `messages/pubsub/error.ts` | `PubSubError`, `PubSubErrorStep`, `PubSubErrorTipo` |
| `messages/pubsub/mensaje.ts` | `Mensaje<T>` |
| `messages/pubsub/task.ts` | `Task<T>` (abstract), `ITask`, `TaskBuilder<T>`, `ETaskCancel` |
| `messages/pubsub/v2/index.ts` | `PubSub` (v2), `PubSubBuild`, `TMessageData`, `ConfigDataQueue` |
| `messages/pubsub/v2/message.ts` | `Message<T>` |
| `messages/pubsub/v2/utiles/message-manager.ts` | `MessageManager`, `LockDAO`, `MessageErrorCode`, `MessageError`/`ProcessingMessageError`/`ProcessedMessageError` |
| `messages/eventarc/publisher/index.ts` | `EventarcPublisher<T>`, `SystemConfig`, `EventarcPublisherBuild` |

### Símbolos

#### `PubSub` (v2, `messages/pubsub/v2/index.ts`)

Cliente sobre `@google-cloud/pubsub`, credenciales cargadas de `files/credenciales/pubsub.json` por
defecto.

```
PubSub
  static build({credenciales?, topic?, subscription?}) → PubSub
  sendMessage(data, topic?, publishOptions?) → Promise<void>
```

`MessageManager` añade sobre esto gestión de **lock distribuido** (`LockDAO`) para procesar mensajes de
forma exclusiva entre réplicas, con jerarquía de errores propia (`MessageError` → `ProcessingMessageError` |
`ProcessedMessageError`).

#### `EventarcPublisher<T>`

Publica eventos a Google Cloud Eventarc (usado para integraciones *event-driven* entre servicios).

**Depende de:** `@google-cloud/pubsub`, `@google-cloud/eventarc-publishing`, `./utiles/fs` (lectura de
credenciales).
**Usado por:** `send-task-system` (cola de tareas pendientes, ver bloque 6) y consumidores externos al
workspace.

---

## 8. Elasticsearch (`modules/elasticsearch/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `elasticsearch/index.ts` | `Elasticsearch`, `IESConfig`, `IElasticSearch`, `IMetadata`, re-exports de tipos `estypes.*` (`SearchRequest`, `BulkRequest`, `ScrollRequest`, etc.) |
| `elasticsearch/error.ts` | `ElasticError extends CustomError` |
| `elasticsearch/ecs.ts` | `ECS` — tipos del *Elastic Common Schema* |
| `elasticsearch/bulk/{base,auto,documento,error,operation,index}.ts` | `BulkBase`, `BulkAuto`, `BulkIndex`/`BulkCreate`/`BulkUpdate`/`BulkDelete`/`BulkScript`, `BulkError`, `Bulk` |
| `elasticsearch/bulk-old/{documento,index}.ts` | Versión anterior de las mismas clases `Bulk*` (legacy, mantenido por compatibilidad) |
| `elasticsearch/bloque/{operation,index}.ts` | `BulkOperation*` (variante basada en `Deferred`), `Bulk` |

### Símbolos

#### `Elasticsearch`

Cliente con **failover multi-nodo** (`ClienteFailover` interno, rota entre nodos ante fallo) sobre el
cliente oficial `@elastic/elasticsearch`. Expone métodos 1:1 con la API de Elasticsearch:
`search`, `scroll`, `clearScroll`, `delete`, etc., todos `Promise`-based y tolerantes a que Elastic no esté
habilitado (`"Elastic not enabled"`).

#### Familias `Bulk*`

Tres generaciones convivientes (`bulk/`, `bulk-old/`, `bloque/`) de *bulk writer* — acumulan operaciones
(`index`/`create`/`update`/`delete`/`script`) y las envían en lotes a Elasticsearch. `bulk/` es la vigente
(usada por `database/bulk/elastic.ts` y `send-task-system`); `bulk-old/` y `bloque/` se mantienen por
compatibilidad con consumidores no migrados — no usar en código nuevo.

**Usado por:** `database/bulk/elastic.ts`, `database/scroll/index.ts` (`ElasticSearchScroll`),
`send-task-system/data/dao/*/impl/elastic-*` (ver bloque 6), `modules/utiles/elastic/*`.

---

## 9. Traducción (`modules/traduccion/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `traduccion/index.ts` | `Translation<T>`, `ITranslation`, `TParams` |
| `traduccion/literal.ts` | `TraduccionLiteral<T>` |
| `traduccion/plural.ts` | `TraduccionPlural<T>` |
| `traduccion/map.ts` | `TraduccionMap<K,T>`, `ITraduccionMapKeys`, `ITraduccionMapValores<K>` |
| `traduccion/set.ts` | `TraduccionSet<T>`, `TValor` |
| `traduccion/v2/index.ts` | `Translation<T>` (abstract, v2) |
| `traduccion/v2/literal.ts` | `Literal<T>` |
| `traduccion/v2/translation-map.ts` | `TranslationMap<K,T>`, `ITranslationMapValues<K>` |
| `traduccion/v2/translation-set.ts` | `TranslationSet<T>` |
| `traduccion/v2/value/{index,value,plural-value,singular-value}.ts` | `TPluralKey`, `Value<T>` (abstract), `PluralValue<T>`, `SingularValue<T>`, `TPluralFunction` |
| `traduccion/v2/util/{lang,plural-function-builder}.ts` | `getLang`, `buildFunction` (default) |
| `traduccion/v2/example.ts` | Ejemplo de uso de `v2/` (no es código de producción) |

### Símbolos

#### `Translation<T extends TParams={}>`

Base de todas las traducciones de dominio (meteo/negocio, distinto de la i18n de `@mr/core-i18n`, que es
de nivel de idioma). Sustituye `{{param}}` en la cadena de salida a partir de `params` declarados en el
constructor:

```
Translation<T>
  protected constructor({id, params=[]}: ITranslation)
  protected aplicarParams(salida, params?) → string
```

`TraduccionLiteral` (cadena fija), `TraduccionPlural` (singular/plural), `TraduccionMap` (diccionario
clave→cadena) son las tres variantes v1. `traduccion/v2/` reimplementa el mismo árbol con soporte de
`PluralValue`/`SingularValue` vía `TPluralFunction` (reglas de pluralización por idioma,
`plural-function-builder.ts`) — **v2 es la versión activa** para nuevo desarrollo; v1 se mantiene por
compatibilidad con literales ya definidos.

**Usado por:** capas de presentación de servicios que renderizan textos meteorológicos/de negocio
localizados (fuera de este workspace).

---

## 10. Status (`modules/status/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `status/interface.ts` | `IService`, `IEndpoint` |
| `status/common/interface.ts` | `TStatus` (enum), `IComponent`, `IService`, `IMonitor`, `IResourceResponse`, `IResolutionGuide`, `IResolutionContact` |
| `status/utiles/config.ts` | `StatusConfig`, `IStatusConfig`, `CONFIG_STATUS_DEFECTO` |
| `status/resource/resource.ts` | `IChecker`, `IResourceGroup`, `IResource`, `IUrl`, `TAlternateResponse`, `I{JSON,Buffer,HTML}AlternateResponse`, `IHeaders` |
| `status/resource/handler.ts` | `Status<T>` (abstract) |
| `status/client/status.ts` | `Status` (clase cliente, distinta de la anterior) |
| `status/client/client.ts` | `Client`, `ISpec<T>`, `IClientConfig`, `default` (factory singleton) |
| `status/client/monitor.ts` | `Monitor` |
| `status/client/component.ts` | `Component` |
| `status/client/spec.ts` | `Spec<K>`, `IWorkspace<T>`, `ICluster<T>`/`IClusters<T>`, `IClusterData` |

### Símbolos

#### `Status<T extends Configuracion>` (abstract, `resource/handler.ts`)

`RouteGroup` (de `@mr/core-network/server/http/routes/group`) que expone `GET /status/{workspace}/`,
devolviendo `IResourceGroup[]` construido por `buildResourceGroup()` (abstract) — cada servicio implementa
qué recursos/checks reporta en su página de status interna.

```
Status<T> extends RouteGroup<T>
  protected abstract getWorkspace(): string
  protected abstract buildResourceGroup(dominio?): Promise<IResourceGroup[]>
```

#### `Client` (`status/client/client.ts`)

Cliente HTTP hacia un **servicio de status centralizado** externo (`IClientConfig.server`):
`loadSpec`/`saveSpec` (specs arbitrarios por servicio) y `saveStatus(components)` (reporta el estado de
componentes). Se obtiene vía el factory `default(config)` (singleton).

**Depende de:** `@mr/core-network/server/http/routes/group` (`RouteGroup`, solo en `resource/handler.ts`),
`@mr/core-network/client/http/interface` (`IRespuesta`), `@mr/core-workload/config` (`Configuracion`, solo
tipo) y `@mr/core-workload/config/pod` (`IPodInfo`, solo tipo).

---

## 11. Email (`modules/email/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `email/manager.ts` | `IMailManager`, `IActor`, `IAttachment`, `IMail`, `TContentTypes`, `TemplateContent<T>`/`ITemplateContent<T>`, `HTMLInlineContent`/`TextInlineContent` |
| `email/managers/spark_post.ts` | `SparkPostManager implements IMailManager` |
| `email/webhook/sparkpost/sparkpost.ts` | Tipos de payload de webhook: `TEvent`, `TMessageEvent`, `TTrackEvent`, `TGenEvent`, `TUnsubscribeEvent`, `IEvent`, `IMessageIDEvent`, `ITrackEvent`, `IUnsubscribeEvent`, `IMSYS`, `IBatch` |
| `email/webhook/sparkpost/auth.ts` | `Auth`, `default auth` |

### Símbolos

`IMailManager` es el contrato genérico de envío de correo (`IMail`, `IActor`, `IAttachment`,
`TContentTypes`); `SparkPostManager` es la única implementación actual, sobre el SDK `sparkpost`. El
sub-módulo `webhook/sparkpost/` tipa y autentica (`Auth`) los eventos entrantes del webhook de SparkPost
(entrega, apertura, click, bounce, unsubscribe, etc.) — usado por
`send-task-system/controller/sparkpost-event-controller.ts` (ver bloque 6).

---

## 12. Módulos auxiliares

Subdirectorios pequeños y autocontenidos (1–15 ficheros); se documentan aquí en tabla, sin bloque propio.

| Directorio | Ficheros | Símbolos principales | Propósito |
|------------|:--------:|-----------------------|-----------|
| `cache/` | 3 | `CacheAdapter<T>` (abstract), `CacheAdapterDisk<T>`, `ConfigCache`/`IConfigCache` | Caché genérica clave→valor con metadata y adaptador a disco (distinta de `net/cache`, que es específica de respuestas HTTP) |
| `decorators/` | 2 | `logCall`, `logRejection`, `logResolve`, `logTime` (decoradores de método), `addGetters` (decorador de clase) | Decoradores TS de logging/instrumentación de métodos y generación de getters |
| `dependency-injection/` | 2 | `Component(name)`, `Inject(name)`, `InstanceCatalog` (`default`) | Micro-contenedor de inyección de dependencias por decoradores + catálogo de instancias |
| `algo/` | 2 | `Individual` (abstract), `Genetic<T>` | Algoritmo genético genérico (selección/cruce/mutación sobre `Individual`) |
| `analytics/` | 1 | `DataLayer` | Gestión del *data layer* de analítica (cliente, distinto de `utiles/analytics(V2).ts`, que es servidor) |
| `fs/` | 2 | `File`/`IFile`, `Storage`/`StorageClient`/`StorageError`/`IDocumento` | Abstracción de ficheros + cliente de Google Cloud Storage (`Storage` implementa `IDocumento`) |
| `google-calendar/` | 3 | `Calendar`, `Event`/`IEvent`, `Attendee`/`IAttendee` | Cliente de Google Calendar (lectura/gestión de eventos y asistentes) |
| `google-elevation/` | 1 | `Client`, `IElevationConfig`/`IElevationResult`/`IElevationItem`/`ILocation` | Cliente de la API de Google Elevation (altitud por coordenadas) |
| `hash/` | 2 | `HashElement<T> extends EventEmitter` | Estructura tipo tabla hash con eventos de cambio |
| `img/` | 1 | `Spline` | Interpolación por *spline* (usado en generación de gráficas/imágenes) |
| `openapi/` | 1 | `IOpenAPI`, `IInfo`, `IPaths`, `IComponents`, ... | Tipos TypeScript del esquema OpenAPI (sin lógica, solo tipado) |
| `services/` | 1 | `ConfigService`/`IConfigService` | Configuración de registro de un servicio individual (nombre/id), consumida por `Service` de `@mr/core-network` |
| `browser/` | 15 | `Validator`/`InputValidator`/`SelectValidator`/`TextAreaValidator`/`CheckValidator`/`FileValidator`/`MailValidator`, `PromiseDelayed`, `AnimationFrame`, `Scheduler`/`Prioridad`, `isBot`, `info`/`warn`/`error`, `cookies` (`default`), `yieldToMainBackground`/`yieldToMainUiBlocking` | **Único módulo orientado a cliente/navegador** del workspace: validación de formularios, utilidades DOM, scheduler cooperativo (`isInputPending`/prioridad), logging y promesas adaptadas al *event loop* del navegador, cookies. No usar desde código de servidor. |

---

## Diagrama de dependencias

```
                         ┌─────────────────────────────┐
                         │      @mr/core-workload        │
                         │  Main · Engine · Engine(HTTP)  │
                         │  Configuracion · IPodInfo       │
                         └───────────┬─────────────┬──────┘
             usa (impl.) ▲           │             │  usa (tipos: Configuracion,
   utiles/{log,fs,hash,  │           │             │  IPodInfo, Google) — import type
   random,promise};      │           ▼             ▼
   net/cache{,disk}      │   engine_event.ts   engine_server_task.ts
             │           │   (EngineEvent)     (EngineServerTask)
             │           │           │             │
             └───────────┴───────────┴─────┬───────┘
                                            │  extendido por engines concretos de servicio
                                            ▼
  ┌─────────────────────────── services-comun/modules ───────────────────────────┐
  │                                                                              │
  │  utiles/*  ──────────────► usado por casi todos los bloques siguientes        │
  │                                                                              │
  │  net/cache ──► database/{redis,valkey} ──► send-task-system (DAO MySQL/      │
  │       │                                     Elastic/PubSub)                  │
  │       │                                          │                           │
  │  status/* ◄── @mr/core-network (RouteGroup)      ▼                           │
  │                                             messages/pubsub  elasticsearch/  │
  │                                             email/ (SparkPost)               │
  │                                                                              │
  │  traduccion/  cache/  decorators/  dependency-injection/  algo/  analytics/  │
  │  fs/  google-calendar/  google-elevation/  hash/  img/  openapi/  services/  │
  │  browser/ (cliente)                                                         │
  └──────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
                    services/* (p. ej. panel-frontend) — Main.ejecutar(MiEngine, MiConfiguracion)
```

**Regla de dependencia:** `@mr/core-workload` y `services-comun` se prestan símbolos mutuamente (el
primero, la orquestación genérica; el segundo, las utilidades de bajo nivel y la lógica de negocio) — no
existe una dirección única "A depende de B". `browser/` es la única excepción de sentido: corre en el
navegador y no debe importarse desde código de servidor.
