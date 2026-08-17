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
| `postgresql/transaction.ts` | `Transaction extends TransactionBase`, `TIsolationLevel` |
| `postgresql/postgre-s-q-l-transaction-manager.ts` | `PostgreSQLTransactionManager extends TransactionManager` |
| `postgresql/notify/notify.ts` | `Notify`, `NotifyCallback` |
| `postgresql/lock/lock.ts` | `Lock` |

### Símbolos

`PostgreSQL` envuelve el driver `pg`; soporta conexión por host o por socket Unix
(`IPostgreSQLHost`/`IPostgreSQLSocket`), es `AsyncDisposable` (`using`/`await using`). `Notify` implementa
el patrón `LISTEN`/`NOTIFY` de PostgreSQL con callback tipado (`TListener`); `Lock` implementa locks
consultivos (`pg_advisory_lock` o equivalente) sobre la misma conexión.

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
| `redis/index.ts` | `Redis implements AsyncDisposable`, `IRedisOptions` |

Cliente sobre el paquete `redis` (`createClient`), con namespace por servicio (usa `IPodInfo` de
`@mr/core-workload/config/pod`, solo tipo) y utilidades de lectura/escritura, serialización JSON y locks
distribuidos. Soporta topología de clúster con nodo `primary` y réplica opcional `read`.

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
| `bulk/redis.ts` | `RedisBulk<T> extends Bulk<T>`, `RedisBulkConfig<T>` |
| `bulk/elastic.ts` | `ElasticSearchBulk extends BulkBase`, `ElasticSearchBulkConfig` |

`Bulk<T>` (abstract) acumula elementos hasta un tamaño de lote (`arrayChop` de `utiles/array.ts`) o un
`delay`, y los envía en una sola operación al backend correspondiente. `ElasticSearchBulk` reutiliza
`BulkBase` de `modules/elasticsearch/bulk/base.ts` en vez del `Bulk<T>` local — es un adaptador delgado
sobre el sistema de *bulk* de Elasticsearch descrito en el bloque 8 del CODEMAP padre.

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
