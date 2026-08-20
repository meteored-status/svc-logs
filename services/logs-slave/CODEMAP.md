# CODEMAP — `logs-slave`

Mapa técnico del workspace `services/logs-slave/`.

## Objetivo

Recibir la notificación (Cloud Storage → Pub/Sub, entrega *push*) de que se ha depositado un
fichero de logs de borde de Cloudflare (Logpush) en uno de los buckets de ingesta, descargarlo,
parsear cada línea con un esquema Zod específico del formato de Cloudflare, enriquecerla
(geolocalización por IP, parseo de user-agent, detección de bot/crawler) y volcar el resultado en
tres tablas de BigQuery: `logs.accesos`, `logs.accesos_crawler` y `logs.accesos_app`. No escribe en
Elasticsearch ni en MySQL — BigQuery es su única capa de persistencia de salida.

Es el hermano de `services/workers-slave` (ver su CODEMAP para el detalle): los dos son servicios
"slave" de un único endpoint que reciben una notificación de GCS y descargan+procesan el objeto
que la disparó, pero divergen en casi todo lo demás — qué tipo de log de Cloudflare consumen
(HTTP de borde aquí, *tail events* de Workers allí), a dónde escriben el resultado (BigQuery aquí,
Elasticsearch allí) y cómo se despliegan (Cloud Run/"lambda" aquí, servicio k8s allí). No comparten
código: `logs-slave` no depende de `packages/workers-base`, y viceversa.

## Árbol de módulos

```text
services/logs-slave/
├─ modules/
│  ├─ engine.ts                         — Engine: arranque HTTP (sin healthcheck propio: usa el `ok()` no-op de la base)
│  ├─ utiles/
│  │  └─ config.ts                      — Configuracion: añade `google` (proyecto GCP "meteored-status")
│  ├─ net/
│  │  └─ handlers/
│  │     └─ slave.ts                    — RouteGroup: POST / (webhook de la notificación de GCS)
│  └─ data/
│     ├─ cliente/
│     │  ├─ index.ts                    — Cliente: identidad + IPs de origen conocidas ("backends"), catálogo cableado en código
│     │  ├─ backends.ts                 — type Backends = Record<ip, nombre> (alias, sin lógica)
│     │  ├─ error.ts                    — ClienteError (CustomError)
│     │  ├─ grupo.ts                    — Grupo: variante de Cliente para subproyectos regionales (p.ej. "tiempo-es")
│     │  └─ gcs.ts                      — ClienteGCS: bucket+carpeta → Cliente, descarga el objeto y dispara el ingest
│     ├─ crawler.ts                     — Crawler: detección de bots por user-agent (paquete `crawler-user-agents`)
│     ├─ registro/
│     │  ├─ index.ts                    — Registro: agregado de una línea ya normalizada + sus 3 serializaciones (BigQuery, crawler, app)
│     │  ├─ cache.ts                    — RegistroCache (estado de caché de Cloudflare)
│     │  ├─ cliente.ts                  — RegistroCliente (ip, device, user-agent parseado, crawler, localización)
│     │  ├─ localizacion.ts             — RegistroLocalizacion (geoip-lite)
│     │  ├─ origen.ts                   — RegistroOrigen (IP de origin + nombre resuelto contra los "backends" del cliente)
│     │  ├─ peticion.ts                 — RegistroPeticion
│     │  └─ respuesta.ts                — RegistroRespuesta
│     └─ source/
│        ├─ cloudflare.ts               — esquema Zod del formato Logpush de Cloudflare (RAW → IRAWData)
│        └─ ingest.ts                   — pipeline: lee el stream línea a línea, aplica el esquema, filtra y vuelca a BigQuery
├─ assets/
│  └─ favicon.ico                       — favicon servido por el handler estándar de @mr/core-workload
├─ files/
│  ├─ credenciales/                     — credenciales de servicio (bigquery.json, storage.json); contenido sensible, no leído
│  ├─ ssl/                              — certificados TLS
│  └─ tmp/                              — generado/temporal (incluye el watcher de shutdown, `admin/shutdown.lock`)
├─ output/                              — código compilado (esbuild); generado, sin valor documental
├─ main.ts                              — Main.ejecutar(Engine, Configuracion)
├─ app.js                               — bootstrap runtime (source-map-support, Datadog, require("./output/app"))
├─ devel.js                             — bootstrap de desarrollo (TZ=UTC, require("./app"))
├─ mrpack.json                          — despliegue Cloud Run ("lambda"), credenciales inyectadas (bigquery.json, storage.json) + conexión Cloud SQL
├─ package.json
├─ tsconfig.json                        — extiende services-comun-status/tsconfig.json
└─ tsconfig.tsbuildinfo                 — caché incremental de TypeScript; no leer/documentar
```

## Arranque

`main.ts`:

```ts
import {Main} from "@mr/core-workload";
import {Configuracion} from "./modules/utiles/config";
import {Engine} from "./modules/engine";

Main.ejecutar(Engine, Configuracion);
```

`app.js` (entrypoint runtime, `package.json#main`) instala `source-map-support`, aplica los
defaults de entorno habituales del monorepo (`CLIENTE`, `ENTORNO=desarrollo`, `SIDECAR=true`,
`ZONA=desarrollo`), inicializa `dd-trace` si `DATADOG=true` y por último `require("./output/app")`
(el bundle de `main.ts`). `devel.js` añade `TZ=UTC` antes de cargar `app.js`.

`modules/engine.ts` extiende el `Engine` HTTP de `@mr/core-workload/engine/server` y solo
registra el `RouteGroup` `Slave` vía `initWebServer([Slave(this.configuracion)], ...)`. **No
sobreescribe `ok()`**: a diferencia de `workers-slave` (que comprueba Elasticsearch), este
servicio no tiene ninguna dependencia externa que valga la pena comprobar en el healthcheck —
Elasticsearch no interviene en absoluto en este pipeline.

## `modules/utiles/config.ts` — `Configuracion`

Extiende la `Configuracion` de `services-comun-status/modules/config/service` añadiendo `google`
(`Google` de `@mr/core-workload/config/google`), con el proyecto GCP fijado en
`"meteored-status"`. **Ojo:** este es un proyecto GCP distinto del que usa `workers-slave`
(`"api-project-858154548956"`, ver `packages/workers-base/modules/utiles/config.ts`) — dos
servicios hermanos del mismo monorepo, cada uno apuntando a su propio proyecto de Google Cloud
para sus buckets de Storage. No se ha investigado más allá de lo que dice el código si son en
realidad el mismo proyecto referenciado de dos formas (nombre vs. número) o dos proyectos
distintos: se documenta la discrepancia tal cual está, sin asumir cuál es el caso.

`Configuracion.load()` sobreescribe el método estático de la base para pasarle el bloque `google`
por defecto (incluyendo la ruta de credenciales `files/credenciales/storage.json`) a `cargar()`.

## Superficie pública — rutas HTTP

Registrada en `modules/net/handlers/slave.ts`, un único `RouteGroup` con una sola ruta:

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| `POST` | `/` (`exact`) | Notificación de Cloud Storage vía Pub/Sub push, con forma de entrada de Cloud Audit Log: `{protoPayload: {resourceName: string}}` | `200` vacío siempre (ver nota) |

`resourceName` llega con la forma `projects/_/buckets/<bucket>/objects/<path>`. El handler la
separa en `/objects/` y le quita a la parte del bucket el prefijo `projects/_/buckets/` con
`base.substring(19)` — **19 es la longitud exacta de ese prefijo literal** (`"projects/_/buckets/"`.length === 19);
si Google cambiara alguna vez el formato de `resourceName`, este `substring` cableado se rompería
en silencio (cortaría el nombre del bucket por el sitio equivocado) sin que nada lo señale como
error.

**El endpoint responde `200` tanto si el procesado tiene éxito como si falla.** El `try/catch`
alrededor de `ClienteGCS.searchBucket` + `cliente.ingest()` solo registra el error con `error(...)`
— nunca se propaga ni cambia el código de respuesta. Esto es intencional dado el remitente (Pub/Sub
push reintentaría la entrega si viera un error HTTP, y algunos de los rechazos aquí — bucket no
registrado, cliente desconocido — no son transitorios y reintentar no los arreglaría), pero
significa que un error real (p.ej. BigQuery caído) se pierde silenciosamente para quien llama; solo
queda rastro en el log del pod.

Si `protoPayload.resourceName` no viene en el body (notificación con otra forma, o payload vacío),
el handler no hace nada y responde `200` igual — no hay validación explícita de la forma del body
más allá de ese único campo opcional.

## Capa de datos

### `modules/data/cliente/` — resolución de identidad del cliente

| Fichero → símbolo | Descripción |
|---|---|
| `index.ts` → `Cliente` | Identidad de un cliente editorial (`ed`, `fce`, `hoteles`, `motor`, `motenic`, `mr`, `tiempo`, …) junto a su tabla de "backends" — IPs de origen conocidas mapeadas a un nombre legible ("GKE Bélgica", "Europa 3", …), usada solo para anotar `RegistroOrigen.nombre` en el registro final. **El catálogo `BACKENDS` está cableado en el código** (`private static BACKENDS`), no en MySQL ni en ningún fichero de configuración: añadir un cliente o una IP de origen nueva exige tocar y redesplegar este fichero. |
| `backends.ts` → `Backends` | `Record<string, string>` (IP → nombre). Sin lógica; existe solo para no repetir el tipo. |
| `error.ts` → `ClienteError` | `CustomError` de dominio (cliente o bucket no encontrado). |
| `grupo.ts` → `Grupo` | Variante de `Cliente` para subproyectos regionales del cliente `tiempo` (`tiempo-ar`, `tiempo-es`, …, un `Grupo` por país). `Grupo.searchID()` resuelve el `Cliente` base y, si hay `grupo`, le aplica `cliente.aplicarGrupo(...)`, que **fusiona** los backends propios del grupo sobre los del cliente base (`{...clienteBackends, ...grupoBackends}`) — el grupo puede añadir o sobreescribir entradas, nunca las elimina. |
| `gcs.ts` → `ClienteGCS` | Resuelve `(bucket, primera-carpeta-del-path)` contra un catálogo `BUCKETS` **también cableado en código** (hoy solo el bucket `"cf-accesos"`, con una entrada por cliente/subproyecto — 27 entradas). `ingest(storage, source)` descarga el objeto y llama a `source/ingest.ts`; si la descarga falla por cualquier motivo (`getArchivo` atrapa cualquier error, sin reintentar) se limita a hacer `console.log` y devolver `undefined` — no usa el logger del monorepo (`services-comun/modules/utiles/log`) en ese punto, a diferencia del resto del servicio. |

**Diferencia notable con `workers-slave`:** el `Bucket` de `workers-base` (usado por `workers-slave`)
reintenta hasta 10 veces con backoff cuando el objeto todavía no es visible tras la notificación
(`err?.code == 404` → `null` y reintento), porque la notificación y la disponibilidad real del
objeto en GCS pueden no ser instantáneas. `ClienteGCS.getArchivo` aquí **no reintenta nada**: cualquier
error al pedir el objeto (incluido un 404 por la misma condición de carrera) se traga con un
`console.log` y el archivo se pierde sin repesca. No hay tabla `repesca`/`procesando` en este
servicio como la que sí tiene `workers-slave` vía `Bucket`/MySQL.

### `modules/data/registro/` — normalización de una línea de log

`Registro` (`index.ts`) es el agregado: `Registro.build(data: IRAWData, cliente: Cliente)`
construye a partir del RAW ya parseado por Zod (`IRAWData`, con las subinterfaces
`IRAWDataClient`/`Edge`/`Origin`/`Cache`/`Request`/`Response`) las cinco piezas
(`RegistroPeticion`, `RegistroCache`, `RegistroRespuesta`, `RegistroCliente`, `RegistroOrigen`) y
calcula `proyecto` (el id del cliente) y `subproyecto` (`cliente.proyecto(respuesta.headers.service)`,
que es el `grupo` si el cliente tiene uno aplicado, o si no el header `x-meteored-service` de la
respuesta de origen).

| Símbolo | Descripción |
|---|---|
| `RegistroCache` | Estado de caché de Cloudflare (`status`, `reserve.used`, `tiered.fill`). |
| `RegistroCliente` | IP, tipo de dispositivo, detección de crawler (`Crawler.test()` sobre el user-agent, o `"Unknown"` si `ip.class==="searchEngine"` pero ningún patrón de `crawler-user-agents` casó) y user-agent parseado (`UAParser`). |
| `RegistroLocalizacion` | Geolocalización de la IP vía `geoip-lite`; `undefined` si la IP no resuelve o le faltan coordenadas. |
| `RegistroOrigen` | IP de origen (backend real que respondió) + `nombre` resuelto contra `cliente.backends` — es aquí donde se usa el catálogo cableado de `cliente/index.ts`. |
| `RegistroPeticion` | Método, esquema, dominio/subdominio (el subdominio se calcula recortando la zona del final del host: `host.substring(0, host.length - zona.length - 1)`), path, referer, y opcionalmente `headers.apiKey` si vino `x-api-key`. |
| `RegistroRespuesta` | Status, tiempo (duración de origen), content-type y opcionalmente `headers.{node,service,version}` de los headers `x-meteored-*`. |

`Registro` expone tres serializaciones distintas, cada una para un destino de BigQuery distinto:

- `toJSON()` → `IRegistroES` — fila de `logs.accesos`, todas las peticiones.
- `toCrawler()` → `IRegistroCrawler` — fila de `logs.accesos_crawler`, solo si `cf.client.bot` vino
  a `true` desde Cloudflare (`VerifiedBotCategory` no vacío en el RAW).
- `toApp(header)` → `IRegistroApp` — fila de `logs.accesos_app`, solo si la petición trae el header
  `meteored` (identificador de app móvil) o cumple una de dos heurísticas legacy cableadas: cliente
  `mr` con path que empieza por `/app/`, o cliente `tiempo` con path que contiene
  `peticionMovil.php`. `toApp()` parsea ese header con una regexp fija
  (`/^(\w+) ([\w.]+); ?([\w./]+)\/([^/^();]+)(?:\((\w+)\))?(?:;(bg|fg)?)?$/`) y **lanza** si no
  casa — es el único punto de `Registro` que puede lanzar, y `source/ingest.ts` lo atrapa por
  petición individual para no perder el resto del lote.

### `modules/data/crawler.ts` — `Crawler`

Envuelve el catálogo de expresiones regulares de `crawler-user-agents` (paquete de npm, no
propio) en una lista de `Crawler` con nombre "humanizado" (limpia grupos de captura típicos de esas
regexps — `\d\.\d+`, clases de carácter case-insensitive, paréntesis de versión — para dar un
nombre corto en vez del patrón crudo). `Crawler.test(ua)` memoiza el resultado por user-agent
exacto en un `Record` en memoria sin límite de tamaño ni expiración — en un servicio de vida corta
por request esto no es un problema práctico, pero si el proceso viviera mucho tiempo con tráfico
muy variado en user-agents el caché crecería sin cota.

### `modules/data/source/` — esquema de entrada y pipeline de salida

- **`cloudflare.ts`**: esquema `zod` del formato Logpush de Cloudflare tal cual lo escribe
  Cloudflare (nombres de campo en `PascalCase`, p.ej. `ClientRequestPath`, `EdgeStartTimestamp`).
  `EdgeStartTimestamp`/`EdgeEndTimestamp` aceptan tanto `string` como `number`; si es `number` se
  interpreta como **nanosegundos** Unix (`Math.floor(o/1000000)` para pasar a milisegundos antes de
  `new Date(...)`) — Logpush puede entregar el timestamp en cualquiera de los dos formatos según la
  configuración del job de Cloudflare. El `.transform()` final reestructura el objeto plano de
  Cloudflare en la forma anidada `IRAWData` que consume `Registro.build()`.
- **`ingest.ts`**: pipeline de una descarga. Abre el stream del objeto de GCS línea a línea
  (`readline`), descarta líneas vacías y las que empiezan por `/cdn-cgi/` (tráfico interno de
  Cloudflare, sin valor analítico), aplica el esquema y construye un `Registro` por línea,
  acumulando las tres listas de salida (`accesos`, `crawler`, `app`) en memoria — **todo el
  fichero se procesa y se guarda en memoria antes de escribir nada**, sin *streaming* hacia
  BigQuery; para un fichero de Logpush razonablemente grande esto es el límite de escalado de este
  pipeline. Al final, `guardar()` inserta cada lista en su tabla de BigQuery
  (`dataset("logs").table(<accesos|accesos_crawler|accesos_app>)`) en bloques de 1000 filas
  (`arrayChop`), y **la llamada a `guardar()` no se espera** (`guardar(...).then(() => undefined)`
  sin `await`) — el handler que llamó a `ingest()` ya ha respondido al cliente Pub/Sub antes de que
  termine (o incluso empiece) la escritura en BigQuery.

El cliente de BigQuery (`BQ = new BigQuery({keyFilename: "files/credenciales/bigquery.json"})`) se
construye como constante de módulo **al margen de la abstracción `Google`/`Storage` que usa el
resto del servicio** para Cloud Storage: la ruta de credenciales está repetida a mano aquí en vez
de derivarse de `configuracion.google`. Si algún día cambia dónde se montan las credenciales de
BigQuery (hoy inyectadas por `mrpack.json` bajo `credenciales[].target: "bigquery.json"`), hay que
recordar que este fichero no pasa por `Configuracion`.

## Flujo de una petición típica

```text
Cloud Storage (bucket "cf-accesos")
  -> objeto nuevo (Cloudflare Logpush deposita un fichero)
  -> Cloud Audit Logs -> Pub/Sub (push) -> POST / logs-slave
  -> Slave.getHandlers()[0].handler(conexion)
       - post.protoPayload.resourceName -> bucket + path
       - ClienteGCS.searchBucket(bucket, path)      (catálogo BUCKETS cableado)
            -> Grupo.searchID(cliente, grupo)        (catálogo BACKENDS cableado)
       - cliente.ingest(configuracion.google, path)
            - descarga el objeto (Storage.getOne, sin reintento)
            - source/ingest.ts:
                 - parsea cada línea con el esquema Zod de Cloudflare
                 - construye un Registro por línea (geoip, UA, crawler, backends)
                 - guarda en BigQuery (accesos / accesos_crawler / accesos_app), sin esperar
            - borra el objeto de GCS
  -> conexion responde 200 (siempre, incluso si algo del try falló; el error solo se loguea)
```

## Dependencias

- **Runtime** (`dependencies`): `@google-cloud/bigquery`, `@google-cloud/storage`, `chokidar`,
  `crawler-user-agents`, `dd-trace`, `formidable`, `geoip-lite`, `hexoid`, `qs`,
  `source-map-support`, `stream-shift`, `supports-color`, `tslib`, `ua-parser-js`, `ws` (+
  opcional `bufferutil`), `zod`. No se ha encontrado import directo de `stream-shift` ni
  `supports-color` en `modules/**`; se documentan tal cual figuran en `package.json`, sin asumir
  un uso que no se ha verificado en las fuentes (puede que los use `readline`/alguna dependencia
  transitiva).
- **Workspaces** (`devDependencies`):
  - `@mr/core-dev` — tsconfig base.
  - `@mr/core-i18n` — tipos de idioma (indirectos, vía `ConfiguracionNet`).
  - `@mr/core-network` — `RouteGroup`, `Conexion`, routing HTTP.
  - `@mr/core-workload` — `Main`, `Engine` HTTP base, `Google`/`IGoogle`, `ConfiguracionNet`.
  - `services-comun` — `Storage` (GCS), `error`/`info` (log), utilidades (`arrayChop`,
    `CustomError`).
  - `services-comun-status` — `Configuracion`/`IConfiguracion` base de servicio, `SERVICES`
    (registro de endpoints k8s/red, aunque este servicio se despliega en Cloud Run).
- **No depende de `packages/workers-base`** ni de `packages/status-base`: pese al nombre
  parecido y al propósito hermano de `workers-slave`, este workspace no comparte código de
  ingesta con él — cada uno tiene su propio `Bucket`/`Cliente` y su propio catálogo cableado.
- **`mrpack.json` provisiona una conexión Cloud SQL** (`cloudsql: ["meteored-status:europe-southwest1:status-master-1"]`)
  **pero no se ha encontrado ningún uso de MySQL en el código de este workspace** (sin `mysql2`
  en `package.json`, sin ningún import de `services-comun/modules/utiles/mysql`). Se documenta la
  discrepancia como incógnita: puede ser configuración de despliegue heredada de una versión
  anterior del servicio, o provisión anticipada para un uso futuro — no se ha determinado cuál.

## Mantenimiento

Si se añade un cliente, un bucket o un backend nuevo:

1. Añadir la entrada en `Cliente.BACKENDS` (`modules/data/cliente/index.ts`) y/o
   `ClienteGCS.BUCKETS` (`modules/data/cliente/gcs.ts`) — ambos catálogos viven en código, no en
   configuración externa ni en MySQL.
2. Si el nuevo cliente necesita distinguir subproyectos regionales, seguir el patrón de
   `tiempo-<país>` en `ClienteGCS.BUCKETS` (mismo `cliente`, `grupo` distinto).

Si se añade un nuevo destino de BigQuery (tabla o dataset):

1. Definir la interfaz de fila en `modules/data/registro/` (siguiendo el patrón `IRegistroXxx`) y
   el método `toXxx()` correspondiente en `Registro`.
2. Añadir la llamada a `guardarDataset()` en `source/ingest.ts#guardar`.
3. Actualizar este CODEMAP (sección "Capa de datos" y el flujo de la petición).
