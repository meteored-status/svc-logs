# CODEMAP — `workers-base`

Mapa técnico del workspace `packages/workers-base/`.

## Objetivo

Acceso a datos e ingesta del dominio de logs de Cloudflare Workers: qué bucket de GCS pertenece a
qué cliente (MySQL), y cómo se descarga y parsea (Zod) el fichero NDJSON de logs que Cloudflare
deposita en ese bucket para indexarlo en Elasticsearch. Es la contraparte de `logs-services`, pero
para un dominio distinto (logs de ejecución de Workers de terceros, no logs de los propios
servicios de este monorepo) y con MySQL como fuente de la relación bucket→cliente en vez de un
esquema fijo por proyecto.

**Un solo consumidor.** Solo `services/workers-slave` lo importa (`Bucket extends BucketBase` en
`modules/data/bucket.ts`, y `GOOGLE` en `modules/utiles/config.ts`). Igual que `status-base`, hoy
no hay nada real que compartir entre varios workspaces: es una separación por capas (acceso a
datos vs. servicio desplegable) dentro de un único flujo, no por reutilización entre varios
servicios.

## Árbol de módulos

```text
packages/workers-base/
├─ modules/
│  ├─ data/
│  │  ├─ bucket.ts            — Bucket (relación bucket↔cliente en MySQL, cola de procesado/repesca, ingest)
│  │  └─ source/
│  │     └─ cloudflare.ts     — Cloudflare (parseo del NDJSON de logs de Workers + indexado)
│  └─ utiles/
│     └─ config.ts            — GOOGLE (config GCP por defecto)
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json                 — nombre de paquete: "workers-base" (coincide con el directorio)
└─ tsconfig.json                 — extiende services-comun-status/tsconfig.json
```

## Superficie pública

### `modules/data/bucket.ts` → `workers-base/modules/data/bucket`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `IBucketMySQL` | `interface` | `{id: string, cliente: string}` — la fila de la tabla `buckets` (`mapping/workers.sql`). |
| `ICliente` | `interface` | `{id: string}` — el cliente resuelto, forma mínima que consume `Cloudflare.ingest()`. |
| `Bucket` | `class` | Representa un bucket de GCS registrado, con el cliente al que pertenece. Constructor `protected`: solo se instancia desde `findBucketEjecutar` o desde una subclase (la de `services/workers-slave` reexpone el mismo patrón). |
| `Bucket.buildSource(notify)` | `static` | `gs://<bucketId>/<objectId>` — el identificador de origen que se guarda en el documento indexado (`SourceCloudflare.source`) y con el que se buscan duplicados (ver `Cloudflare.limpiarDuplicados`). |
| `Bucket.findBucket(bucket)` | `protected static` | Resuelve un `Bucket` por id, **cacheado indefinidamente en memoria** (`CACHE: NodeJS.Dict<Promise<Bucket>>`, sin invalidación ni TTL). Una vez resuelto un bucket en el proceso, si su fila `cliente` cambia en MySQL, ese cambio no se recoge hasta que el proceso se reinicia. Rechaza (`Bucket no registrado: <id>`) si la fila no existe. |
| `Bucket.addProcesando`/`update`/`procesando`/`repescando`/`endProcesando` | `static` | Escrituras directas (`db.insert`, incluidas las que son lógicamente `UPDATE`/`DELETE` — ver ojo abajo) sobre la tabla `procesando`, que registra en qué estado está cada fichero notificado (`recibido` → `procesando` → fin, o `error`/`repescando` si algo falla). |
| `Bucket.addRepesca(notify, repesca, cliente?, err?)` | `static` | Registra el fallo en la tabla `repesca` (upsert: `contador=contador+1` si ya existía) y marca `procesando.estado = "error"`. `origen` es `"ingest"` la primera vez y `"repesca"` en reintentos. |
| `Bucket.getCliente()` | instance | `{id: this.cliente}` — construye el `ICliente` a partir del bucket ya resuelto. |
| `Bucket.ingest(storage, notify, signal, repesca)` | instance, `async` | Descarga el fichero (`getArchivo`, con reintento exponencial simple hasta 10 veces salvo 404, que se trata como "no está, no es un error"), delega el parseo/indexado en `Cloudflare.ingest()`, borra el registro de `repesca` si existía y borra el fichero de GCS ya procesado. |

**Ojo:** `addProcesando`, `update` y `procesando` ejecutan sentencias `INSERT ... ON DUPLICATE KEY
UPDATE` o `UPDATE` puros a través de `db.insert(...)`, no de `db.update()`. Funciona porque
`services-comun/modules/utiles/mysql` enruta igual las escrituras sin transacción independientemente
del método que se llame (todas van a *master*), pero el nombre del método no dice lo que la
consulta hace de verdad.

Hay además un `// private static readonly TIMEOUT = 60000;` comentado en la clase, sin usar en
ningún sitio — resto de una implementación anterior, no una constante activa.

### `modules/data/source/cloudflare.ts` → `workers-base/modules/data/source/cloudflare`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `SourceCloudflare` | `interface` | Forma del documento que se indexa: `{"@timestamp", entrypoint?, status: "ok"\|"canceled"\|"exception", script, event: {rayID, request: {url, method}, response: {status}, type: "fetch"\|"tail"}, exceptions?, logs?, tags?, version: {id, message?, tag?}, namespace?, source}`. `source` no viene del propio log de Cloudflare: lo añade `parse()` a partir de `Bucket.buildSource(notify)`. |
| `Cloudflare` | `class` | Parseo (Zod) e indexado de líneas NDJSON de [Workers Trace Events](https://developers.cloudflare.com/workers/observability/logs/tail-workers/) que Cloudflare vuelca al bucket. Todo estático, sin instancia. |
| `Cloudflare.ingest(cliente, notify, storage, signal, repesca)` | `static async` | Lee el fichero línea a línea (`readline`, `crlfDelay: Infinity`), descarta líneas vacías, parsea cada una (`parse()`) y encola su indexado (`guardar()`) sin esperar a que cada una termine individualmente — solo al final, `Promise.all`. Si `signal` se aborta a mitad, corta la lectura y rechaza con `Error("Abortado")`. Si `repesca` es `true`, antes de leer nada intenta borrar del índice los documentos que ya existieran con el mismo `source` (`limpiarDuplicados`), para que reprocesar el mismo fichero no duplique entradas. Devuelve el nº de líneas válidas procesadas. |
| `Cloudflare.parse(json, source)` | `private static` | `JSON.parse` + `SCHEMA.parse` (Zod, `.strict()`: rechaza campos no declarados en el esquema de Cloudflare); en error, hace `error("Cloudflare.parse", ...)` y devuelve `null` en vez de propagar — una línea corrupta se descarta y sigue con las demás. |

**Ojo — el índice de "limpiar duplicados" no es el índice donde se escribe.**
`limpiarDuplicados()` busca y borra en `workers-accesos-<cliente.id>`, pero `guardar()` indexa cada
documento en `logs-worker-<cliente.id>` — son dos nombres de índice **distintos**, y no se ha
encontrado en este repositorio ninguna plantilla (`mapping/`) ni alias que relacione uno con el
otro. Tal como está el código, un reintento (`repesca: true`) busca coincidencias por `source` en
un índice que no es el que recibe las escrituras nuevas, así que la limpieza de duplicados
probablemente no encuentra nada que borrar. No se ha podido confirmar contra el clúster si
`workers-accesos-*` es un alias/índice real que sí incluye `logs-worker-*`, un nombre antiguo que
quedó sin actualizar, o si de verdad no se está deduplicando nunca — cualquiera de las tres cambia
el riesgo de tocar esta ruta de código.

`guardar()` reintenta hasta 10 veces (con backoff, más agresivo — ×10 — si el error es de
conexión) solo ante *timeout* o error de conexión; cualquier otro error de indexado va directo a
`Bucket.addRepesca()` sin reintentar aquí (la repesca es el mecanismo de reintento a otro nivel,
por todo el fichero). El primer `catch` hace también `console.log(err)`, que no sigue la
convención de logging del resto del fichero (`error()`/`info()` de `services-comun/modules/utiles/log`).

### `modules/utiles/config.ts` → `workers-base/modules/utiles/config`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `GOOGLE` | `const IGoogle` | Configuración GCP por defecto: `id: "api-project-858154548956"`, credenciales de Storage en `files/credenciales/storage.json`, **`storage.buckets: {}`** — vacío a propósito: los buckets no se registran aquí de forma estática, se resuelven en tiempo de ejecución contra la tabla MySQL `buckets` (`Bucket.findBucket`), así que no hace falta declararlos en la config de cada servicio. |

Todo el fichero es este único valor exportado; no hay clase de configuración propia (a diferencia
de `status-base`, que sí tiene su propia `Configuracion`).

## Interfaz `INotify` — duplicada tres veces, nunca exportada

`{bucketId: string, objectId: string}` (el payload mínimo de una notificación de GCS) se declara
como interfaz **local, no exportada** en tres sitios distintos, idéntica letra por letra:
`modules/data/bucket.ts` (este paquete), `modules/data/source/cloudflare.ts` (este paquete, otra
vez) y `services/workers-slave/modules/data/bucket.ts` (el consumidor, que además la extiende como
`INotifyPubSub` con los campos propios de Pub/Sub). Al no estar exportada desde ningún sitio, cada
fichero que la necesita la vuelve a escribir en vez de importarla una sola vez.

## Dependencias

`devDependencies` declaradas en `package.json`:

- `@elastic/elasticsearch` — tipos del cliente (usado indirectamente vía
  `services-comun/modules/utiles/elastic{,/bulk}`).
- `@mr/core-workload` (workspace) — `Google`/`IGoogle` (`config/google`), tipa `GOOGLE` y es el
  parámetro de `Bucket.ingest()`/`getArchivo()`.
- `@types/node`
- `services-comun` (workspace) — `modules/fs/storage` (`Storage`, descarga/borrado en GCS),
  `modules/utiles/{promise,mysql,log,elastic,elastic/bulk}`.
- `services-comun-status` (workspace) — de aquí extiende su `tsconfig.json`; no se ha encontrado
  ningún import directo de sus módulos en el código de este paquete.
- `tslib`
- `zod` — esquema y validación estricta del NDJSON de Cloudflare (`Cloudflare.SCHEMA*`).

## Consumidores directos

| Paquete | Ficheros consumidores | Uso |
|---------|------------------------|-----|
| `services/workers-slave` | `modules/data/bucket.ts` (`Bucket extends BucketBase`, donde `BucketBase` es el `Bucket` de este paquete, renombrado en el import para no chocar de nombre — mismo patrón que `ComponentBase` en `svc-status/packages/status-backend-base`), `modules/utiles/config.ts` (`GOOGLE`) | Único consumidor. `Bucket.run(config, notify, signal)` es el punto de entrada desde el handler de Pub/Sub (`modules/net/handlers/slave.ts`, no documentado aquí — vive en el servicio): filtra por `eventType` (solo procesa `OBJECT_FINALIZE`; `OBJECT_DELETE` está deshabilitado por filtro de PubSub y cualquier otro tipo solo se registra con `info()`), encadena las escrituras de estado de `BucketBase` (`addProcesando` → `findBucket` → `update` → `procesando`) y por último `bucket.ingest(config.google, notify, signal, false)` — siempre con `repesca: false` desde este punto de entrada; la vía de `repesca: true` no se ha encontrado invocada desde ningún sitio de este monorepo, así que ese camino (incluida la deduplicación de `Cloudflare.limpiarDuplicados`) parece no ejecutarse hoy en producción salvo que exista un disparador fuera de este código. |

`services/logs`, `services/logs-slave` y `services/logs-web` no declaran ni importan
`workers-base`.

## Flujo de uso típico

```text
services/workers-slave (handler Pub/Sub, notificación OBJECT_FINALIZE)
  Bucket.run(config, notify, signal)
    -> BucketBase.addProcesando(notify)                    (workers-base: MySQL procesando)
    -> BucketBase.findBucket(notify.bucketId)               (workers-base: MySQL buckets, cacheado en memoria)
    -> BucketBase.update(notify, cliente)                   (workers-base: MySQL procesando.cliente)
    -> BucketBase.procesando(notify)                        (workers-base: MySQL procesando.estado)
    -> bucket.ingest(config.google, notify, signal, false)  (workers-base: Bucket.ingest)
         -> Storage.getOne(...)                             (services-comun/modules/fs/storage, descarga de GCS)
         -> Cloudflare.ingest(cliente, notify, storage, signal, false)
              -> parse() por línea (Zod)                    (workers-base: Cloudflare.parse)
              -> guardar() -> bulk.create({index: `logs-worker-${cliente.id}`, doc})
         -> BucketBase.endProcesando(notify) / addRepesca(notify, false, cliente, err)
```

## Mantenimiento

1. Antes de tocar `Cloudflare.limpiarDuplicados()` o cualquier código de la ruta `repesca: true`,
   confirmar contra el clúster real si `workers-accesos-<cliente>` y `logs-worker-<cliente>` son
   de verdad índices distintos o si hay un alias que los une — este mapa no lo ha podido verificar
   (ver el "ojo" de más arriba) y es la pieza más importante para saber si la deduplicación
   funciona.
2. Si se añade un tercer sitio que necesite `{bucketId, objectId}`, considerar exportar `INotify`
   desde un único punto en vez de redeclararla — ya hay tres copias idénticas, no exportadas,
   entre este paquete y `services/workers-slave`.
3. `Bucket.findBucket()` cachea para siempre: si se añade una vía para reasignar el `cliente` de un
   bucket ya en uso, hay que decidir explícitamente si ese cambio necesita invalidar la caché en
   caliente o si basta con esperar al siguiente despliegue/reinicio.
4. Actualizar la tabla de "Superficie pública" y, si cambia algún consumidor, la de "Consumidores
   directos" en este CODEMAP.
