# CODEMAP — `workers-slave`

Mapa técnico del workspace `services/workers-slave/`.

## Objetivo

Recibir la notificación de que Cloud Storage ha guardado un fichero de *tail events* de
Cloudflare Workers (logs de ejecución de los scripts, no tráfico de borde/CDN), descargarlo,
parsear cada línea con un esquema Zod propio del formato de tail-log de Workers y volcar el
resultado en Elasticsearch (`logs-worker-<cliente>`), con seguimiento en MySQL del estado de cada
fichero (`procesando`/`repesca`) para poder reintentar los que fallan.

Es el hermano de `services/logs-slave` (ver su CODEMAP para el detalle): comparten la forma —un
único endpoint que recibe una notificación de GCS y procesa el objeto que la disparó—, pero
divergen en casi todo lo demás: el tipo de log de Cloudflare que consumen (tail events de Workers
aquí, HTTP de borde allí), el destino de los datos (Elasticsearch aquí, BigQuery allí), y cómo se
despliegan (servicio k8s "alone" aquí, Cloud Run/"lambda" allí). `logs-slave` no comparte código
con este servicio.

**Todo el código vive aquí.** Hasta 2026-09-08 la capa de dominio —`Bucket` (MySQL) y `Cloudflare`
(Zod + Elasticsearch)— estaba en un workspace aparte, `packages/workers-base`, del que este
servicio era el único consumidor. Se fusionó dentro: el paquete no compartía nada con nadie, así
que la separación solo obligaba a leer dos workspaces, mantener dos `package.json` y encadenar
`Bucket extends BucketBase` para lo que hoy es una sola clase.

## Árbol de módulos

```text
services/workers-slave/
├─ modules/
│  ├─ engine.ts                         — Engine: arranque HTTP + healthcheck (elasticsearch.info())
│  ├─ utiles/
│  │  └─ config.ts                      — Configuracion: añade `google` (proyecto GCP "api-project-858154548956")
│  ├─ net/
│  │  └─ handlers/
│  │     └─ slave.ts                    — RouteGroup: POST /private/workers/ingest/ y /pubsub/workers/ingest/
│  └─ data/
│     ├─ bucket.ts                      — Bucket: relación bucket↔cliente en MySQL, cola procesando/repesca, descarga de GCS y flujo de un evento
│     └─ source/
│        └─ cloudflare.ts               — Cloudflare: esquema Zod del NDJSON de tail events + indexado en Elasticsearch
├─ assets/
│  └─ favicon.ico                       — favicon servido por el handler estándar de @mr/core-workload
├─ files/                                — no explorado en detalle (credenciales/config de despliegue); ver mrpack.json
├─ output/                               — código compilado (esbuild); generado, sin valor documental
├─ main.ts                               — Main.ejecutar(Engine, Configuracion)
├─ app.js                                — bootstrap runtime (source-map-support, Datadog, require("./output/app"))
├─ devel.js                              — bootstrap de desarrollo (TZ=UTC, require("./app"))
├─ mrpack.json                           — despliegue k8s ("service", target "k8s", `alone: true`), multi-arch (amd64+arm64)
├─ package.json
├─ tsconfig.json                         — extiende services-comun-status/tsconfig.json
└─ tsconfig.tsbuildinfo                  — caché incremental de TypeScript; no leer/documentar
```

## Arranque

`main.ts`:

```ts
import {Main} from "@mr/core-workload";
import {Configuracion} from "./modules/utiles/config";
import {Engine} from "./modules/engine";

Main.ejecutar(Engine, Configuracion);
```

`app.js`/`devel.js` siguen el mismo patrón que el resto de servicios del monorepo (ver el CODEMAP
de `logs-slave` o `status-external` para el detalle del bootstrap).

`modules/engine.ts` registra un único `RouteGroup` (`Slave`) vía `initWebServer()` y sobreescribe
`ok()` con `elasticsearch.info()` — a diferencia de `logs-slave`, este servicio sí depende de
Elasticsearch (es su destino de datos), así que el healthcheck lo reflexiona.

## `modules/utiles/config.ts` — `Configuracion`

Extiende la `Configuracion` de `services-comun-status/modules/config/service` añadiendo `google`
(`Google` de `@mr/core-workload/config/google`), con los valores por defecto de la constante
`GOOGLE` declarada en este mismo fichero: proyecto GCP `"api-project-858154548956"`, credenciales
en `files/credenciales/storage.json` y `storage.buckets` vacío a propósito (los buckets se
resuelven en ejecución contra MySQL, no se declaran de forma estática). **Ojo:** este es
un proyecto GCP distinto del que usa `logs-slave` (`"meteored-status"`) — ver la nota
correspondiente en el CODEMAP de ese servicio; no se ha determinado si son en realidad el mismo
proyecto referenciado de dos formas o dos proyectos distintos.

## Superficie pública — rutas HTTP

Registradas en `modules/net/handlers/slave.ts`, un único `RouteGroup` con dos rutas que resuelven
al **mismo** procesamiento (`parseWorker`) pero aceptan dos formatos distintos de notificación:

| Método | Ruta (`prefix`) | Body | Respuesta |
|--------|-----------------|------|-----------|
| `POST` | `/private/workers/ingest/` | `INotify` directo: `{bucketId, objectId}` | `200` inmediato (ver nota fire-and-forget) |
| `POST` | `/pubsub/workers/ingest/` | Envoltorio de Pub/Sub: `{message: {attributes: INotifyPubSub, data, messageId, publishTime, ...}}` | `200` inmediato |

Ambas rutas usan `prefix` (no `exact`), así que cualquier URL que empiece por esos literales hace
match, con o sin lo que venga detrás de la barra final.

`/private/workers/ingest/` es el único de los dos que **completa a mano** los campos que le faltan
al body para convertirlo en un `INotifyPubSub` completo antes de pasarlo a `Bucket.run()`:
`eventTime: ""`, `eventType: "OBJECT_FINALIZE"` (forzado, sin comprobar que sea verdad),
`notificationConfig: ""`, `objectGeneration: ""`, `payloadFormat: ""`. Es decir, esta ruta asume
que **todo** lo que le llega es un alta de objeto — no hay forma de que este endpoint reciba un
borrado u otro tipo de evento; solo `/pubsub/workers/ingest/` (que sí trae `eventType` real en
`message.attributes`) puede distinguirlos.

**Las dos rutas responden `200` antes de que termine el procesamiento**: `this.sendRespuesta(conexion)`
se llama y se espera (`await`) **antes** de invocar `this.parseWorker(...)`, que a su vez llama a
`Bucket.run(...)` sin `await` en el handler (es una promesa "suelta" con su propio `.catch()`). El
llamante (GCS o Pub/Sub) recibe el `200` en cuanto el servidor acepta la petición, no cuando el
objeto se ha procesado — igual que en `logs-slave`, aunque aquí el motivo declarado es distinto: no
bloquear al notificador mientras se hace la descarga y el `bulk` a Elasticsearch, que pueden tardar.
Los errores de ese procesamiento en segundo plano se registran (`Bucket.addRepesca()` + `error(...)`
en el log), nunca llegan al llamante.

`parseWorker()` trata como éxito silencioso (sin `error()`, sin marcar repesca, se atrapa y se
descarta) el caso en que el error de `Bucket.run()` sea una excepción de MySQL de
`"Duplicate entry"` — es decir, si el mismo evento de notificación llega dos veces (algo que
Pub/Sub puede hacer legítimamente, no garantiza entrega exactamente-una-vez), el segundo intento de
`Bucket.addProcesando()`/inserción choca contra la clave única y se ignora en vez de tratarse como
un fallo real.

## Capa de datos

### `modules/data/bucket.ts` — `Bucket`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `INotify` | `interface` | `{bucketId, objectId}` — el payload mínimo de una notificación de GCS. **Exportado**: antes se redeclaraba idéntico en tres ficheros distintos (los dos del paquete y este); ahora se declara una vez y `cloudflare.ts` lo importa. |
| `INotifyPubSub` | `interface` (extiende `INotify`) | Forma completa de una notificación de objeto: `bucketId`, `objectId`, `eventTime`, `eventType`, `notificationConfig`, `objectGeneration`, `payloadFormat`. |
| `IBucketMySQL` | `interface` | `{id, cliente}` — la fila de la tabla `buckets` (`mapping/workers.sql`). |
| `ICliente` | `interface` | `{id}` — el cliente resuelto, forma mínima que consume `Cloudflare.ingest()`. |
| `Bucket` | `class` | Un bucket de GCS registrado, con el cliente al que pertenece. Constructor `private`: solo se instancia desde `findBucketEjecutar()`. |
| `Bucket.buildSource(notify)` | `static` | `gs://<bucketId>/<objectId>` — el identificador de origen que se guarda en el documento indexado (`SourceCloudflare.source`) y con el que se buscan duplicados. |
| `Bucket.findBucket(bucket)` | `private static` | Resuelve un `Bucket` por id, **cacheado indefinidamente en memoria** (`CACHE`, sin invalidación ni TTL). Si la fila `cliente` cambia en MySQL, el cambio no se recoge hasta reiniciar el proceso. Rechaza (`Bucket no registrado: <id>`) si no existe. |
| `Bucket.addProcesando`/`update`/`procesando`/`repescando`/`endProcesando` | `static` | Escrituras sobre la tabla `procesando`, que registra el estado de cada fichero notificado (`recibido` → `procesando` → fin, o `error`/`repescando` si algo falla). |
| `Bucket.addRepesca(notify, repesca, cliente?, err?)` | `static` | Registra el fallo en la tabla `repesca` (upsert: `contador=contador+1`) y marca `procesando.estado = "error"`. `origen` es `"ingest"` la primera vez y `"repesca"` en reintentos. |
| `Bucket.run(config, notify, signal)` | `static async` | Punto de entrada único del pipeline. Si `eventType !== "OBJECT_FINALIZE"`, no procesa nada: `"OBJECT_DELETE"` se ignora explícitamente ("deshabilitado por filtro de PubSub" — la suscripción ya debería filtrarlo antes de llegar aquí, y este `switch` es una defensa adicional) y cualquier otro tipo se registra con `info()` como "todavía no soportado". Para `OBJECT_FINALIZE`: `addProcesando` → `findBucket` → `getCliente()` → `update` → `procesando` → `ingest(...)`. Si `ingest()` falla, llama a `addRepesca()` en vez de propagar. |
| `Bucket.getCliente()` | instance | `{id: this.cliente}`. |
| `Bucket.ingest(storage, notify, signal, repesca)` | instance, `async` | Descarga el fichero (reintento con backoff lineal hasta 10 veces; un `404` se trata como "no está", no como error, porque el objeto puede no ser visible aún tras la notificación), delega el parseo/indexado en `Cloudflare.ingest()`, borra el registro de `repesca` si existía y borra el fichero ya procesado de GCS. |

**Ojo:** `addProcesando`, `update` y `procesando` ejecutan `INSERT ... ON DUPLICATE KEY UPDATE` o
`UPDATE` puros a través de `db.insert(...)`, no de `db.update()`. Funciona porque
`services-comun/modules/utiles/mysql` enruta igual todas las escrituras sin transacción (van a
*master*), pero el nombre del método no dice lo que la consulta hace de verdad.

### `modules/data/source/cloudflare.ts` — `Cloudflare`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `SourceCloudflare` | `interface` | Forma del documento que se indexa: `{"@timestamp", entrypoint?, status: "ok"\|"canceled"\|"exception", script, event: {rayID, request: {url, method}, response: {status}, type: "fetch"\|"tail"}, exceptions?, logs?, tags?, version: {id, message?, tag?}, namespace?, source}`. `source` no viene del log de Cloudflare: lo añade `parse()` con `Bucket.buildSource(notify)`. |
| `Cloudflare` | `class` | Parseo (Zod) e indexado de líneas NDJSON de [Workers Trace Events](https://developers.cloudflare.com/workers/observability/logs/tail-workers/). Todo estático. |
| `Cloudflare.ingest(cliente, notify, storage, signal, repesca)` | `static async` | Lee el fichero línea a línea (`readline`, `crlfDelay: Infinity`), descarta vacías, parsea cada una y encola su indexado sin esperarla individualmente — solo al final, `Promise.all`. Si `signal` se aborta a mitad, corta la lectura y rechaza con `Error("Abortado")`. Con `repesca: true`, antes de leer nada borra del índice los documentos con el mismo `source` (`limpiarDuplicados`). Devuelve el nº de líneas válidas. |
| `Cloudflare.parse(json, source)` | `private static` | `JSON.parse` + `SCHEMA.parse` (Zod `.strict()`: rechaza campos no declarados); en error registra con `error()` y devuelve `null` — una línea corrupta se descarta y sigue con las demás. |

`guardar()` reintenta hasta 10 veces (con backoff, ×10 si el error es de conexión) solo ante
*timeout* o error de conexión; cualquier otro error de indexado va directo a `Bucket.addRepesca()`
sin reintentar aquí (la repesca es el reintento a otro nivel, por todo el fichero).

**Ojo — el índice de "limpiar duplicados" no es el índice donde se escribe.**
`limpiarDuplicados()` busca y borra en `workers-accesos-<cliente.id>`, pero `guardar()` indexa en
`logs-worker-<cliente.id>` — dos nombres **distintos**, y no se ha encontrado en este repositorio
ninguna plantilla (`mapping/`) ni alias que los relacione. Tal como está el código, un reintento
(`repesca: true`) busca coincidencias en un índice que no es el que recibe las escrituras nuevas,
así que la limpieza de duplicados probablemente no encuentra nada que borrar. No se ha podido
confirmar contra el clúster si `workers-accesos-*` es un alias real que incluya `logs-worker-*`, un
nombre antiguo que quedó sin actualizar, o si de verdad no se deduplica nunca.

Es discutible mientras nadie active la repesca: **`bucket.ingest(..., false)` se llama siempre con
`repesca: false`** desde `Bucket.run()`, y no se ha encontrado en el monorepo ningún sitio que
invoque la vía `repesca: true`. `Cloudflare.limpiarDuplicados()` parece no ejecutarse nunca hoy.

**Diferencia notable con `logs-slave`:** aquí sí hay tablas `procesando`/`repesca` en MySQL que
registran el estado de cada fichero y permiten reintentar los que fallaron; `logs-slave` no tiene
ningún equivalente — un fallo ahí se pierde sin dejar rastro reintentable.

## Flujo de una petición típica

```text
Cloud Storage (bucket de Workers) o Pub/Sub (push)
  -> objeto nuevo (tail log de un Worker)
  -> POST /private/workers/ingest/  { bucketId, objectId }
       (o POST /pubsub/workers/ingest/  { message: { attributes: {...} } })
  -> Slave.parseWorker(notify)
  -> conexion responde 200 (sin esperar el resultado del procesamiento)
  -> Bucket.run(configuracion, notify, signal)      [en segundo plano]
       - addProcesando(notify)                       MySQL: INSERT/UPDATE tabla `procesando`
       - findBucket(notify.bucketId)                 MySQL: SELECT tabla `buckets` (con caché)
       - update(notify, cliente)                     MySQL: UPDATE `procesando` (cliente resuelto)
       - procesando(notify)                           MySQL: UPDATE `procesando` estado="procesando"
       - bucket.ingest(config.google, notify, signal, false)
            - descarga el objeto de GCS (reintenta si 404, hasta 10 veces)
            - Cloudflare.ingest(): parsea cada línea (esquema Zod propio de tail events)
                 y hace bulk.create() en Elasticsearch (logs-worker-<cliente>)
            - borra el objeto de GCS y la fila de `repesca` si existía
       - endProcesando(notify)  (éxito)  o  addRepesca(notify, false, cliente, err)  (fallo)
```

## Dependencias

- **Runtime** (`dependencies`): `@elastic/elasticsearch`, `@google-cloud/storage`, `chokidar`,
  `dd-trace`, `formidable`, `hexoid`, `mysql2`, `qs`, `source-map-support`, `tslib`, `ws` (+
  opcional `bufferutil`).
- **Workspaces** (`devDependencies`):
  - `@mr/core-dev` — tsconfig base.
  - `@mr/core-i18n` — tipos de idioma (indirectos, vía `ConfiguracionNet`).
  - `@mr/core-network` — `RouteGroup`, `Conexion`, routing HTTP.
  - `@mr/core-workload` — `Main`, `Engine` HTTP base, `Google`/`IGoogle`, `ConfiguracionNet`.
  - `services-comun` — `elasticsearch` (cliente), `error`/`info` (log).
  - `services-comun-status` — `Configuracion`/`IConfiguracion` base de servicio, `SERVICES`.
  - `zod` — esquema y validación estricta del NDJSON de tail events (`Cloudflare.SCHEMA*`). Llegó
    aquí al fusionar `packages/workers-base`, donde ya estaba declarada con este mismo rango.
- **No depende de `services/logs-slave`** ni comparte ningún fichero con él, pese al propósito
  hermano — ver "Objetivo" más arriba.

## Mantenimiento

Si se añade un tipo de evento de notificación nuevo a soportar (además de `OBJECT_FINALIZE`):

1. Añadir el caso al `switch` de `Bucket.run()` (`modules/data/bucket.ts`).
2. Actualizar la tabla de "Capa de datos" de este CODEMAP.

Antes de tocar `Cloudflare.limpiarDuplicados()` o cualquier código de la ruta `repesca: true`,
confirmar contra el clúster real si `workers-accesos-<cliente>` y `logs-worker-<cliente>` son de
verdad índices distintos o si hay un alias que los une — este mapa no lo ha podido verificar (ver
el "ojo" de la sección de `cloudflare.ts`) y es la pieza que decide si la deduplicación funciona.

`Bucket.findBucket()` cachea para siempre: si se añade una vía para reasignar el `cliente` de un
bucket ya en uso, hay que decidir explícitamente si ese cambio necesita invalidar la caché en
caliente o si basta con esperar al siguiente reinicio.
