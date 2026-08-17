# `services-comun/modules/database`

Drivers de base de datos y utilidades de acceso a datos compartidas por todos los servicios del monorepo.
Cubre MySQL, PostgreSQL, AlloyDB (PostgreSQL gestionado de Google Cloud), Redis y ValKey, además de un
contrato común de **transacciones** por driver, *bulk writers*, paginación por cursor (*scroll*) sobre
Elasticsearch, paginación simple y transacciones "fake"/sobre Google Cloud Storage.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).
**Bloque padre:** [`services-comun/README.md`](../../README.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Transacciones (contrato común)](./CODEMAP.md#transacciones-contrato-común-transaction) | `services-comun/modules/database/transaction` | `Transaction`/`TransactionManager` (abstractas) + decorador `@transactional` |
| [MySQL](./CODEMAP.md#mysql-mysql) | `services-comun/modules/database/mysql` | `MySQL implements Disposable`, `MySQLTransactionManager`, caché de consultas (`Cache`/`CacheBuilder`, memoria/disco/mock) |
| [PostgreSQL](./CODEMAP.md#postgresql-postgresql) | `services-comun/modules/database/postgresql` | `PostgreSQL implements AsyncDisposable`, `PostgreSQLTransactionManager`, `Notify` (LISTEN/NOTIFY), `Lock` |
| [AlloyDB](./CODEMAP.md#alloydb-alloydb) | `services-comun/modules/database/alloydb` | `AlloyDB extends PostgreSQL` — mismo driver sobre credenciales/endpoint de AlloyDB |
| [Redis](./CODEMAP.md#redis-redis) | `services-comun/modules/database/redis` | `Redis implements AsyncDisposable` — cliente con namespace por servicio, locks distribuidos |
| [ValKey](./CODEMAP.md#valkey-valkey) | `services-comun/modules/database/valkey` | `ValKey` — equivalente a `Redis` sobre el protocolo/cliente ValKey (`@valkey/valkey-glide`) |
| [Bulk writers](./CODEMAP.md#bulk-writers-bulk) | `services-comun/modules/database/bulk` | `Bulk<T>` (abstract) + `MySQL`/`PostgreSQLBulk`/`RedisBulk`/`ElasticSearchBulk` |
| [Scroll](./CODEMAP.md#scroll-scroll) | `services-comun/modules/database/scroll` | `Scroll<T>` (abstract), `ElasticSearchScroll` — cursor de paginación sobre Elasticsearch |
| [Pagination](./CODEMAP.md#pagination-pagination) | `services-comun/modules/database/pagination` | `Pagination<T>` — paginación genérica por callback `loadPage` |
| [Cloud Storage](./CODEMAP.md#cloud-storage-cloud-storage) | `services-comun/modules/database/cloud-storage` | `GoogleCloudTransactionManager`/`GoogleCloudTransaction` — transacción "no-op" para operaciones sobre GCS |
| [Fake](./CODEMAP.md#transacciones-contrato-común-transaction) | `services-comun/modules/database/transaction/fake` | `FakeTransactionManager`/`FakeTransaction` — implementación nula para tests |

---

## Patrón de transacciones

Todos los drivers comparten el mismo contrato (`transaction/transaction-manager.ts`,
`transaction/transaction.ts`):

```ts
abstract class Transaction implements ITransaction {
    public readonly hash: string;               // identificador corto para logs
    public abstract begin(isolationLevel?: IsolationLevel): Promise<void>;
    public abstract commit(): Promise<void>;
    public abstract rollback(): Promise<void>;
}

abstract class TransactionManager {
    public abstract get(): Promise<Transaction>;
}
```

Cada driver aporta su propio par `XxxTransactionManager`/`Transaction` (MySQL, PostgreSQL — reutilizado por
AlloyDB —, y las variantes `Fake`/`GoogleCloud` para casos sin transacción real). El decorador
`transactional(getTM, options?)` de `transaction/transaction.ts` envuelve un método para abrir automática-
mente una transacción (o unirse a una recibida por parámetro), hacer *commit*/*rollback* según el resultado
y loguear el ciclo completo (`BEGIN`/`JOIN`/`COMMIT`/`ROLLBACK`/`LEAVE`) fuera de producción.

Ver detalle completo de símbolos y ficheros en [`CODEMAP.md`](./CODEMAP.md).

---

## Changelog

El historial de cambios de este subsistema se registra en el `CHANGELOG.md` del workspace padre:
[`services-comun/CHANGELOG.md`](../../CHANGELOG.md).
