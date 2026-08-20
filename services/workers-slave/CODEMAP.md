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
despliegan (servicio k8s "alone" aquí, Cloud Run/"lambda" allí). Este servicio delega casi toda su
lógica de negocio en el workspace compartido `packages/workers-base`; pese al nombre "base", el
único consumidor real de ese paquete en el monorepo es este workspace (`grep` de `"workers-base"`
en los `package.json` del repo solo lo encuentra en la raíz —como listado de workspaces— y en
`workers-slave`). `logs-slave` no comparte código con ninguno de los dos.

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
│     └─ bucket.ts                      — Bucket: extiende el Bucket de packages/workers-base con el flujo de un evento de notificación
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
(`Google` de `@mr/core-workload/config/google`), con los valores por defecto de
`packages/workers-base/modules/utiles/config.ts` (`GOOGLE`): proyecto GCP
`"api-project-858154548956"`, credenciales en `files/credenciales/storage.json`. **Ojo:** este es
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

### `modules/data/bucket.ts` — `Bucket` (extiende `packages/workers-base`)

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `INotifyPubSub` | `interface` (extiende `INotify` de `workers-base`) | Forma completa de una notificación de objeto: `bucketId`, `objectId`, `eventTime`, `eventType`, `notificationConfig`, `objectGeneration`, `payloadFormat` — el subconjunto de los campos que trae una notificación GCS real que este servicio necesita para decidir qué hacer. |
| `Bucket.run(config, notify, signal)` | `static async` | Punto de entrada único del pipeline. Si `eventType !== "OBJECT_FINALIZE"`, no procesa nada: `"OBJECT_DELETE"` se ignora explícitamente con un comentario ("deshabilitado por filtro de PubSub" — es decir, la suscripción de Pub/Sub ya debería estar filtrando estos eventos antes de que lleguen aquí, y este `switch` es una defensa adicional) y cualquier otro tipo se registra con `info()` como "todavía no soportado". Para `OBJECT_FINALIZE`: marca el fichero como recibido (`addProcesando`), resuelve el `Bucket` (fila de MySQL) por `bucketId` con caché en memoria por proceso (`findBucket`, `Bucket.CACHE`, nunca se invalida), resuelve el `ICliente` asociado, marca `procesando` y llama a `bucket.ingest(...)` (heredado de `workers-base`), que descarga el objeto y lo pasa a `Cloudflare.ingest()` (también de `workers-base`). Si `ingest()` falla, llama a `Bucket.addRepesca()` en vez de propagar. |

El resto de la lógica —resolución del bucket contra MySQL (tabla `buckets`), seguimiento en las
tablas `procesando`/`repesca`, descarga con reintento (10 intentos con backoff lineal si el objeto
todavía no es visible tras la notificación, `err?.code == 404`) y el parseo/escritura en
Elasticsearch (`Cloudflare.ingest()`, índice `logs-worker-<cliente.id>`)— vive en
`packages/workers-base` en vez de en este workspace, aunque hoy `workers-slave` sea su único
consumidor (ver "Dependencias"); separarlo así deja el terreno preparado si en el futuro otro
servicio necesita el mismo acceso a `buckets`/`procesando`/`repesca`. No se repite aquí en detalle;
`packages/workers-base/CODEMAP.md` ya lo documenta con su propia sección "Consumidores directos"
dedicada exactamente a esta llamada desde `workers-slave`, e incluye dos hallazgos que afectan
directamente a este servicio y que no se repiten aquí:

- **`bucket.ingest(..., false)` se llama siempre con `repesca: false`** desde este `Bucket.run()` —
  no se ha encontrado en el monorepo ningún sitio que invoque la vía `repesca: true`. La limpieza
  de duplicados de `Cloudflare.limpiarDuplicados()` (que solo se activa con `repesca: true`) parece
  no ejecutarse nunca desde este servicio en su forma actual.
- El índice donde `limpiarDuplicados()` buscaría (`workers-accesos-<cliente>`) **no es** el índice
  donde `guardar()` escribe (`logs-worker-<cliente>`) — dos nombres distintos, sin alias
  confirmado que los una. Irrelevante mientras el punto anterior siga siendo cierto, pero relevante
  el día que alguien active la repesca desde aquí.

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
       - bucket.ingest(config.google, notify, signal, false)   [workers-base]
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
  - `workers-base` (`packages/workers-base`) — toda la lógica de dominio compartida: `Bucket`
    base (MySQL: tablas `buckets`, `procesando`, `repesca`), `Cloudflare` (esquema Zod de tail
    events + escritura en Elasticsearch) y la configuración GCP por defecto (`GOOGLE`).
- **No depende de `services/logs-slave`** ni comparte ningún fichero con él, pese al propósito
  hermano — ver "Objetivo" más arriba.

## Mantenimiento

Si se añade un tipo de evento de notificación nuevo a soportar (además de `OBJECT_FINALIZE`):

1. Añadir el caso al `switch` de `Bucket.run()` en este fichero (`modules/data/bucket.ts`), no en
   `workers-base` — es aquí donde se decide qué tipos de evento le interesan a este servicio en
   concreto.
2. Si el nuevo tipo necesita un flujo de procesamiento distinto (no solo "ignorar" o "loguear
   como no soportado"), decidir si vive en este fichero o si conviene subirlo a `workers-base` por
   si otros consumidores lo necesitan también.
3. Actualizar la tabla de "Capa de datos" de este CODEMAP.
