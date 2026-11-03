# CODEMAP — `services-comun/modules/database`

> Segmentado por bloques. Ver [`README.md`](./README.md) para el overview y el patrón común de
> transacciones. Bloque padre: [`../../CODEMAP.md`](../../CODEMAP.md#5-base-de-datos-modulesdatabase).

---

## Transacciones (contrato común) (`transaction/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `transaction/transaction.ts` | `Transaction` (abstract), `ITransaction`, `TransactionOptions`, `transactional()` |
| `transaction/transaction-manager.ts` | `TransactionManager` (abstract) |
| `transaction/isolation.ts` | `IsolationLevel` (enum) |
| `transaction/fake/fake-transaction.ts` | `FakeTransaction extends Transaction` |
| `transaction/fake/fake-transaction-manager.ts` | `FakeTransactionManager extends TransactionManager` |

### Símbolos

```
Transaction (abstract)
  hash: string                              — id corto (derivado de md5(random+timestamp+random))
  begin(isolationLevel?: IsolationLevel)    (abstract)
  commit()                                   (abstract)
  rollback()                                 (abstract)

TransactionManager (abstract)
  get() → Promise<Transaction>               (abstract)

transactional(getTM: () => TransactionManager, {name?, isolationLevel?}): Function
  — decorador de método: abre transacción (o se une a una recibida como último argumento),
    hace commit/rollback automático según el resultado, logea BEGIN/JOIN/COMMIT/ROLLBACK/LEAVE
    fuera de producción.
```

`FakeTransactionManager`/`FakeTransaction` son una implementación *no-op* (usada en tests o repositorios
sin persistencia transaccional real).

**Implementado por:** `mysql/my-s-q-l-transaction-manager.ts`, `postgresql/postgre-s-q-l-transaction-manager.ts`
(reutilizado por AlloyDB), `cloud-storage/google-cloud-transaction-manager.ts`.

---

## MySQL (`mysql/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `mysql/index.ts` | `MySQL implements Disposable`, `IMySQL`, `TipoRegistro`, `ISelectOptions<T,S>`, `IInsert`, `IUpdate`, `LoadDataInfileQueryOptions` |
| `mysql/transaction.ts` | `Transaction extends TransactionBase`, `TIsolationLevel`, `transactional()` (variante local) |
| `mysql/my-s-q-l-transaction-manager.ts` | `MySQLTransactionManager extends TransactionManager` |
| `mysql/cache/index.ts` | `Cache<T>` (abstract), `CacheBuilder` (abstract), `ICache<T>`, `ICacheConfig`, `ICacheConfigDefault`, `ICacheDoc<T>` |
| `mysql/cache/memory.ts` | `MemoryCache<T> extends Cache<T>`, `default` (`CacheBuilder`) |
| `mysql/cache/disk.ts` | `DiskCache<T> extends Cache<T>`, `ICacheDiskConfig`, `default` (`CacheBuilder`) |
| `mysql/cache/mock.ts` | `default` (`CacheBuilder`) — caché nula para tests |

### `MySQL`

Wrapper sobre `mysql2/promise` con **pool cluster** (soporta *master* + *slaves* vía `createPoolCluster`),
`static build({credenciales?, database?})` que carga credenciales desde
`files/credenciales/mysql.json` (o `DATABASE`/`process.env.DATABASE`), y helpers de consulta con caché
opcional por *select* (`ISelectOptions.cache`, resuelto por `Cache`/`CacheBuilder`). Implementa
`Disposable` para liberar el pool automáticamente con `using`.

### Caché de consultas (`mysql/cache/`)

Patrón *builder*: `CacheBuilder` (abstract) construye instancias de `Cache<T>` (abstract) — con tres
implementaciones intercambiables: `MemoryCache` (proceso), `DiskCache` (fichero), y una versión `mock`
(no cachea, para tests). Se selecciona vía la configuración de caché pasada al `SELECT`.

---

## PostgreSQL (`postgresql/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `postgresql/index.ts` | `PostgreSQL implements AsyncDisposable`, `IPostgreSQL`, `IPostgreSQLConnectionOptions`, `IPostgreSQLBuild`, `TipoRegistro`, `IInsert`, `TListener` |
| `postgresql/startup-options.ts` | `startupOptions` (los `settings` de la conexion como opcion de arranque `-c nombre=valor` de libpq) |
| `postgresql/transaction.ts` | `Transaction extends TransactionBase`, `TIsolationLevel` |
| `postgresql/postgre-s-q-l-transaction-manager.ts` | `PostgreSQLTransactionManager extends TransactionManager` |
| `postgresql/notify/notify.ts` | `Notify`, `NotifyCallback` |
| `postgresql/lock/lock.ts` | `Lock` |

### Símbolos

`PostgreSQL` envuelve el driver `pg`; soporta conexión por host o por socket Unix
(`IPostgreSQLHost`/`IPostgreSQLSocket`), es `AsyncDisposable` (`using`/`await using`). `Notify` implementa
el patrón `LISTEN`/`NOTIFY` de PostgreSQL con callback tipado (`TListener`); `Lock` implementa locks
consultivos (`pg_advisory_lock` o equivalente) sobre la misma conexión.

`IPostgreSQLConnectionOptions.settings` fija parámetros de sesión (`work_mem`, `statement_timeout`,
`pg_trgm.similarity_threshold`...) en CADA conexión de los pools de esa instancia, como opciones de arranque: valen
fuera de una transacción —a diferencia de `SET LOCAL`— y no se quedan pegados en una conexión que use otro. Para
consultas con ajustes distintos se construye otro `PostgreSQL`/`AlloyDB` con los suyos (cada uno tiene sus pools).
Prueba en `spec/database/postgresql/startup-options.spec.ts`.

**Reutilizado por:** `AlloyDB` (hereda `PostgreSQL` íntegro) y `AlloyDBTransactionManager` (hereda
`PostgreSQLTransactionManager`).

---

## AlloyDB (`alloydb/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `alloydb/index.ts` | `AlloyDB extends PostgreSQL` |
| `alloydb/transaction.ts` | `Transaction extends TransactionBase` |
| `alloydb/alloy-d-b-transaction-manager.ts` | `AlloyDBTransactionManager extends PostgreSQLTransactionManager` |

No añade funcionalidad nueva: solo redefine `static build()` con credenciales por defecto
`files/credenciales/alloydb.json` — es el mismo driver PostgreSQL apuntando al servicio gestionado AlloyDB
de Google Cloud.

---

## Redis (`redis/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `redis/index.ts` | `Redis implements AsyncDisposable`, `IRedisOptions`, `IBulkHIncrByOptions`, `IBulkHGetAllOptions`, `IExpireOptions`, re-exporta `IHIncrBy` y `TBatchResult` |
| `redis/cluster.ts` | `RedisCluster implements AsyncDisposable` (interno; estáticos `MAX_RECONNECT_DELAY_MS` y `reconnectDelay()`), `IRedisNode`, `IClusterOptions`, `IReconnectDelayOptions`, `validateSingleNode()`, `isOlderRedis()`, `redisVersion()`, `warnIfOldRedis()` |
| `../utiles/log-throttle.ts` | `LogThrottle` (un log por tipo e intervalo), `errorType()` — lo usan `RedisCluster`, `Redis` y el monitor en tiempo real de cmp-web |
| `redis/batch.ts` | `RedisBatch` (`new RedisBatch(items)` valida y agrupa los TTL en `ttls`; `execute(client, timeoutMs)`; estático `classifyError()`), y los tipos `TBatchResult`, `IHIncrBy`, `IBatchMulti`, `IBatchClient` |

Cliente sobre el paquete `redis` (`createClient`), con namespace por servicio (usa `IPodInfo` de
`@mr/core-workload/config/pod`, solo tipo) y utilidades de lectura/escritura, serialización JSON y locks
distribuidos. Soporta topología de clúster con nodo `primary` (uno o varios) y réplica opcional `read`.

**Conexión (`RedisCluster`).** Un cliente por primario y otro para `read` si es un nodo distinto, abiertos en la primera operación o, con `connectOnBuild`, al construir `Redis`.
node-redis reconecta solo y sin rendirse: tras perder una conexión establecida el primer reintento es inmediato y, si falla, esperan 200 ms, 400 ms… (+0–249 ms) hasta
`maxReconnectDelayMs` (5000 por defecto); `on('error')` solo registra (un log por tipo y minuto, `logThrottleMs`). Sin cola offline: `primaries`, `read` y `single` devuelven el cliente si
está listo y, si no, rechazan al instante con `ClientOfflineError`; solo un nodo que **nunca** ha conectado (arranque) espera a conectar durante la ventana de gracia de
`4 × clientTimeout + 700 ms` desde que se creó el clúster. Si `read` es el mismo host y puerto que un primario, comparte su cliente. Se cierra con `close()` acotado y `destroy()` de
respaldo (que no lanza); una conexión que termine su handshake después de cerrar se destruye. Los avisos de los métodos con Redis caído salen una vez por tipo de error y por
`logThrottleMs`, con la causa original en `cause`. Requisito: `redis` ≥ 6.3.0 (con una anterior se escribe un `warning` al crear el primer clúster).

**Contrato de los métodos con Redis caído.** Escrituras sueltas (`set`, `hSet`, `zAdd`, `save*`, `releaseLock`): registran y resuelven sin escribir;
lecturas (`get`, `hGet`, `hGetAll`, `load*`): `null`; `searchKeys`: `[]`; `searchMaxScore`: `null`; `aquireLock`: `null`; `bulkSet`, `bulkHSet`,
`bulkHGetAll` y `expire`: rechazan; `bulkHIncrBy`: `notSent`. Las escrituras con varios primarios van a **todos**, salvo las de un solo nodo.

**Escritura sin replicar, en un nodo.** Con varios primarios, `set`, `hSet`, `bulkSet`, `bulkHSet`, `zAdd` y los locks escriben en
**todos** (best-effort, o propagando el error en `bulk*`). Para contadores eso no sirve (se contarían varias veces), así que hay un «nodo
único» (`IRedisOptions.singleNode`, índice en `primary`, por defecto 0) con operaciones propias:

- `bulkHIncrBy(items: IHIncrBy[], {shared, timeoutMs}) → Promise<TBatchResult>`: un `MULTI` con un `HINCRBY` por elemento y un
  `EXPIRE` por clave (mayor TTL del lote), solo en el nodo único. Nunca rechaza por fallos de Redis (`ok` / `notSent` / `ambiguous`).
- `bulkHGetAll(keys, {shared, node}) → Promise<(Record<string,string>|null)[]>`: hashes en crudo, sin el envoltorio `{expires, data}`;
  rechaza si falla. `node: "single"` (por defecto) o `"read"`.
- `expire(key, ttl, {shared, target})`: `"all"` (por defecto) o `"single"`; propaga errores.

**Procesos que terminan.** Los jobs y cronjobs (`Main.ejecutar`) acaban con `process.exit()`, así que el cliente no los retiene: salen solos porque el getter `pod.cronjob`
(`@mr/core/dev/manifest/deployment/index.ts:180`) incluye el tipo `job`; un job declarado como `service` no saldría por sí solo y un cliente que reconecta lo mantendría vivo. Un script sin
`Main` debe liberar el cliente con `await redis[Symbol.asyncDispose]()` para terminar solo; `@redis/client` 6.3.0 no permite soltar el temporizador de PING ni el de reconexión con
`unref()`. Tras liberar con Redis caído, el proceso puede tardar hasta `maxReconnectDelayMs` + 250 ms (~5,25 s por defecto) en salir (medido entre 0,1 y 4,9 s).

**Limitación conocida: Redis conectado pero mudo.** Si Redis está conectado y no responde, `get`, `set`, `aquireLock`, los `MULTI` y el resto de métodos existentes **no tienen límite de
tiempo**: en node-redis `timeout` solo limita la espera antes de enviar y no hay timeout de socket. No es una regresión (el cliente anterior tenía el mismo hueco). Quien lo necesite,
que lo ponga al llamar (p. ej. con `PromiseTimeout`). `bulkHIncrBy` sí lo tiene (`timeoutMs`).

**Limitaciones de node-redis 6.3.0:** `MULTI` ignora `commandOptions.timeout` y `disableOfflineQueue`. Por eso `set`, `hSet`, `bulkSet`, `bulkHSet` y `get` con varias
claves —todos por `MULTI`— no tienen timeout; `bulkHIncrBy` comprueba `isReady` y acota el `EXEC` con su propio temporizador (`RedisBatch.execute`).
Detalle del cambio de comportamiento respecto al cliente que recreaba los clientes ante un error (y de los dos fallos que arregla) en el
[`CHANGELOG.md`](../../CHANGELOG.md) de `services-comun` (2026.10.30).

**Pruebas:** `spec/database/redis/` (`batch.spec.ts`, `cluster.spec.ts`, `redis.spec.ts`), esta última contra el servidor RESP falso de `fake-resp.ts`.

---

## ValKey (`valkey/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `valkey/index.ts` | `ValKey`, `IValkeyOptions` |

Equivalente funcional de `Redis` sobre `@valkey/valkey-glide` (fork de Redis mantenido por AWS/comunidad
Valkey). Comparte forma de API con `Redis` para facilitar la migración entre ambos backends; ver también
`net/cache/valkey{,/valkey,/defaultValkey}.ts` (bloque 4 del CODEMAP padre) para el uso como caché HTTP.

---

## Bulk writers (`bulk/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `bulk/index.ts` | `Bulk<T>` (abstract), `BulkConfig` |
| `bulk/my-s-q-l.ts` | `MySQL<T> extends Bulk<T>`, `MySQLBulkConfig<T>` |
| `bulk/postgre-s-q-l.ts` | `PostgreSQLBulk<T> extends Bulk<T>`, `PostgreSQLBulkConfig<T>` |
| `bulk/redis.ts` | `RedisBulk<T> extends Bulk<T>`, `RedisBulkConfig<T>`, `RedisHBulk<T> extends Bulk<T>`, `RedisHBulkConfig<T>` |
| `bulk/elastic.ts` | `ElasticSearchBulk extends BulkBase`, `ElasticSearchBulkConfig` |

`Bulk<T>` (abstract) acumula elementos hasta un tamaño de lote (`arrayChop` de `utiles/array.ts`) o un
`delay`, y los envía en una sola operación al backend correspondiente. `ElasticSearchBulk` reutiliza
`BulkBase` de `modules/elasticsearch/bulk/base.ts` en vez del `Bulk<T>` local — es un adaptador delgado
sobre el sistema de *bulk* de Elasticsearch descrito en el bloque 8 del CODEMAP padre.

`BulkConfig.chunk` acota el tamaño de cada operación enviada al backend. `my-s-q-l.ts`,
`postgre-s-q-l.ts` y `elastic.ts` lo delegan a su capa inferior (`size`/`blockSize`); `bulk/redis.ts`
no tiene esa capa y trocea él mismo con `arrayChop` (`utiles/array.ts`), emitiendo un `MULTI` por lote
—`RedisBulk.CHUNK_DEFECTO = 5000` si no se indica `chunk`—. Esto es obligatorio y no una optimización:
un `MULTI` con decenas de miles de comandos monopoliza la cola de escritura del cliente, y el `PING`
de `pingInterval` (que sí está sujeto a `commandOptions.timeout`, a diferencia de los comandos dentro
del `MULTI`) aborta encolado detrás, provocando el reset de conexiones de `RedisCluster`.
El tope no puede subirse sin más: `RedisBulk` encola dos comandos por item (`SET` + `EXPIRE`), y
`EXEC` es atómico, así que mientras el lote se ejecuta el servidor no atiende a ningún otro cliente.
`RedisHBulk` es la variante para campos de hash (`bulkHSet`), con caducidad lógica por campo.

**Usado por:** `send-task-system` (persistencia de envíos/eventos en Elasticsearch en lote).

---

## Scroll (`scroll/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `scroll/index.ts` | `Scroll<T>` (abstract), `TCloseFunction`, `ElasticSearchScroll extends Scroll<SortResults>` |

Cursor de paginación sobre resultados grandes de Elasticsearch (`_scroll_id`): `id`, `control` (valor de
`sort` para *search_after*), `close()` (invoca `TCloseFunction`, normalmente `clearScroll`).

---

## Pagination (`pagination/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `pagination/index.ts` | `Pagination<T>` |

Paginación genérica independiente de backend: se construye con `pageSize` y un callback
`loadPage(page, pageSize) => Promise<T[]>`; `next()` avanza una página y devuelve `false` cuando no hay más
resultados.

---

## Cloud Storage (`cloud-storage/`)

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `cloud-storage/google-cloud-transaction.ts` | `GoogleCloudTransaction extends Transaction` |
| `cloud-storage/google-cloud-transaction-manager.ts` | `GoogleCloudTransactionManager extends TransactionManager` |

Implementación *no-op* del contrato de transacciones (Google Cloud Storage no soporta transacciones ACID
multi-objeto) — permite que código que opera indistintamente sobre BD transaccional o GCS use la misma API
(`@transactional`) sin ramificar por backend.

---

## Diagrama de dependencias

```
                    transaction/ (Transaction, TransactionManager — contrato)
                          ▲            ▲            ▲            ▲
                          │            │            │            │
                    mysql/Transaction  postgresql/   alloydb/     cloud-storage/
                    MySQLTM            Transaction   Transaction  GoogleCloudTransaction(Manager)
                                       PostgreSQLTM   AlloyDBTM
                                            ▲
                                            │ extiende (hereda TODO el driver)
                                        alloydb/ (AlloyDB extends PostgreSQL)

  mysql/  postgresql/  redis/  valkey/   ──►  bulk/{my-s-q-l,postgre-s-q-l,redis}.ts
  modules/elasticsearch (bulk/base)      ──►  bulk/elastic.ts, scroll/ (ElasticSearchScroll)

  pagination/  — independiente, sin dependencias del resto del bloque
```

**Regla de dependencia:** cada driver es independiente de los demás salvo `alloydb/` (que hereda
`postgresql/` completo) y los adaptadores `bulk/*`/`scroll/` (que dependen de su driver/`elasticsearch/`
correspondiente). `transaction/` es el único punto de acoplamiento transversal.
