# CODEMAP — `logs-web`

Mapa técnico del workspace `services/logs-web/`.

## Objetivo

Recibir por HTTP los logs de servicio y de error que emiten el resto de servicios del
monorepo (`/service/logs/service/`, `/service/logs/error/`) y encolarlos en Elasticsearch
vía `BulkAuto`. Es el único punto de **escritura** de esos dos flujos, y desde que se retiró
`services/logs` es el único servicio de este repositorio que los toca: la consulta para mostrarlos
en el panel (listados, filtros, marcado de revisados) la hace `status-backend`, en el repo
`svc-status` — ver «Quién lee lo que se escribe aquí» más abajo, es la sección más relevante si se
está tocando la forma del documento.

> **El nombre "web" es engañoso**: no es una app de frontend ni sirve páginas. Es un
> servicio HTTP de ingesta, con la misma forma que `status-external` del repo hermano
> `svc-status` (un `RouteGroup` con handlers POST). El `description` de su
> `package.json` («Servicio de receptor de Logs desde PubSub») tampoco es exacto: no hay
> ningún import de PubSub en `modules/**` de este workspace; ese texto es una copia
> literal del `description` de `services/logs-slave` (que sí es el receptor de PubSub) y
> parece no haberse actualizado al crear `logs-web`. No se ha corregido aquí, solo se
> documenta la discrepancia.

## Árbol de módulos

```text
services/logs-web/
├─ modules/
│  ├─ engine.ts                      — Engine: arranque HTTP, registra el único RouteGroup (Slave)
│  ├─ utiles/
│  │  └─ config.ts                   — Configuracion (extiende services-comun-status + StatusConfig)
│  ├─ net/
│  │  └─ handlers/
│  │     └─ slave.ts                 — RouteGroup: POST /service/logs/{service,error}/
│  └─ data/
│     ├─ servicio.ts                 — ingest(): encola Log en logs-services vía BulkAuto
│     ├─ error.ts                    — ingest(): encola Error en logs-services vía BulkAuto + auto-monitoring de fallos
│     └─ status.ts                   — SlaveSpec: estado propio del pod (grupo LOGS_SLAVE) para el panel Status
├─ assets/
│  └─ favicon.ico                    — favicon servido por el handler favicon de @mr/core-workload
├─ files/                            — todo bajo files/* está en .gitignore (credenciales, certs SSL, tmp); nada aquí es fuente versionada, no se documenta su contenido
├─ output/                           — código generado por el build (esbuild); sin valor documental
├─ main.ts                           — Main.ejecutar(Engine, Configuracion)
├─ app.js                            — bootstrap runtime: source-map-support, Datadog tracer, requiere ./output/app
├─ devel.js                          — fuerza TZ=UTC y requiere ./app (modo desarrollo)
├─ mrpack.json                       — despliegue: servicio k8s "logs-web", bundler esbuild, framework "meteored"
├─ package.json                      — nombre de workspace "logs-web", scripts packd/devel
└─ tsconfig.json                     — extiende services-comun-status/tsconfig.json
```

## Superficie pública

### Rutas HTTP

Registradas en `modules/engine.ts` vía `initWebServer([Slave(this.configuracion)], configuracion.net)`.
No hay handlers WebSocket (`getWSHandlers()` no está sobreescrito).

`Slave` (`modules/net/handlers/slave.ts`) extiende `RouteGroup<Configuracion>` de
`@mr/core-network/server/http/routes/group`:

| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| `POST` | `/service/logs/service/` | `ILogServicioPOST` (`{proyecto, servicio, tipo, severidad, mensaje, extra?}`) — sin validación de esquema en runtime, solo `as ILogServicioPOST` | `200` inmediato, `{ok: true, data: undefined}` (`this.sendRespuesta(conexion)` sin `data`) |
| `POST` | `/service/logs/error/` | `ILogErrorPOST` (`{proyecto, servicio, url, mensaje, archivo, linea, traza?, ctx?}`) — mismo cast sin validación | `200` inmediato, igual que el anterior |

Ambas rutas declaran `checkQuery: false` (no esperan query string) y llaman a
`conexion.noCache()`.

**Orden de la respuesta frente a la ingesta**: en los dos handlers, `sendRespuesta()` se
`await`-ea y se responde **antes** de llamar a `ingestLog(post)` / `ingestError(post, ...)`,
y ninguna de las dos llamadas se espera (`ingest*` no es `await`-eado, ni su resultado se
devuelve al cliente). Es decir, el servicio confirma la recepción al que hace la petición
sin esperar a que el documento llegue a Elasticsearch — pensado para no penalizar la
latencia del que reporta el log. La consecuencia es que un fallo al indexar nunca se ve en
la respuesta HTTP; solo se refleja (parcialmente, ver más abajo) en el propio estado interno
del servicio.

## Capa de datos

### `servicio.ts` / `error.ts` — ingesta (escritura)

Ambos módulos son delgados: construyen el documento con las clases del paquete
**compartido** `logs-services` (`packages/logs-services/modules/data/{servicio,error}.ts`,
nombre de paquete `logs-services`) y lo encolan con una instancia propia de
`BulkAuto` (`services-comun/modules/elasticsearch/bulk/auto`) apuntando a `elastic`
(`services-comun/modules/utiles/elastic`):

```
ingestLog(data: ILogServicioPOST): void
  → new Log(...)                    — logs-services/modules/data/servicio
  → BULK.create({index: Log.getIndex(proyecto), doc: documento.toJSON()})

ingestError(data: ILogErrorPOST, config): void
  → new Error(...)                  — logs-services/modules/data/error
  → BULK.create({index: Error.getIndex(proyecto), doc: documento.toJSON()})
       .promise.catch(async (err) => { ... })   — ver "Asimetría" más abajo
```

`Log.getIndex(proyecto)` / `Error.getIndex(proyecto)` (en `logs-services`) devuelven
`mr-log-servicios-<proyecto>` / `mr-log-errores-<proyecto>` (proyecto en minúsculas); esos
mismos índices están agrupados bajo los alias `mr-log-servicios` / `mr-log-errores`
(`Log.getAlias()` / `Error.getAlias()`, también en `logs-services`).

### Quién lee lo que se escribe aquí — **mismos índices, otro repositorio**

Lo que se indexa aquí lo consulta **`status-backend`**, del repo hermano `svc-status`
(`modules/data/log/registro/{servicio,error}.ts`, rutas `/backend/log/{servicio,error}/…`), sobre
exactamente los mismos alias `mr-log-servicios` y `mr-log-errores`: no hay transformación
intermedia ni un índice «de lectura» separado. Así que **cualquier cambio de forma de documento, de
nombre de índice o de alias rompe a los dos a la vez**, y lo hace en silencio: son dos
repositorios que compilan por separado.

Ese contrato —los alias y las interfaces `ILogServicioES`/`ILogErrorES`— vive por eso en el
framework compartido, en `services-comun-status/modules/services/logs/logs/elastic.ts`. Aquí se
sigue escribiendo con las clases `Log`/`Error` de `logs-services`, que declaran lo mismo por su
cuenta: **son dos declaraciones del mismo documento**, y si una cambia sin la otra, la ingesta y la
consulta dejan de entenderse. Lo suyo, el día que se toque, es que `logs-services` importe del
framework en lugar de repetirlo.

Antes esa consulta la servía `services/logs`, un segundo servicio de este mismo repositorio
(`EService.logs`, endpoint interno `switch-svc-logs`), que se retiró al mover los listados a
`status-backend`. El motivo no fue de organización: aquellos endpoints eran internos y sin
autenticación, y se creían el parámetro `projects` que les llegara, así que el filtro de «qué
proyectos puede ver este usuario» acababa aplicándolo el BFF del panel. Este servicio sigue siendo
`EService.logs_web` con endpoint `proxy-svc-logs-web` — el prefijo `proxy-` indica que se expone
fuera del clúster interno, coherente con que lo llaman los propios servicios monitorizados para
reportar sus logs.

### Asimetría entre `ingestError` e `ingestLog`

Solo `error.ts` engancha algo al resultado de `BULK.create(...)`
(`.promise.catch(async (err) => {...})`); `servicio.ts` llama a `BULK.create(...)` y
descarta el valor devuelto sin `.catch` ni `.then`. `BulkOperation` (lo que devuelve
`create()`) **extiende** `Deferred` (`services-comun/modules/utiles/promise`): su
`.promise` ya existe y ya puede rechazar en cuanto `Bulk` procese la respuesta y
encuentre un `item.error` (`services-comun/modules/elasticsearch/bulk/index.ts`), se lea
o no `.promise` desde el llamador. Es decir, un fallo al indexar un log de **servicio**
no se captura en ningún sitio de este workspace — a diferencia de un fallo al indexar un
log de **error**, que sí:

```
ingestError(...).catch(err) →
    SlaveSpec.get(config)
    → logsSpec.cluster.elastic.current_publish.errors.push({error: err.message})
    → logsSpec.cluster.elastic.current_publish.count++
    → logsSpec.cluster.elastic.current_publish.date = Date.now()
    → logsSpec.buildMonitors()   — publica el monitor "Elasticsearch" en el panel Status
```

No se ha verificado si esto llega a producir un *unhandled rejection* en producción (depende
de si algo más, fuera de este workspace, engancha el bulk global); se documenta la asimetría
tal cual está en el código, sin asumir su gravedad real.

### `status.ts` — `SlaveSpec` (auto-monitorización)

Extiende `LogsSpec<ISpec>` de `logs-status-base` (paquete `packages/status-base`, nombre
npm `logs-status-base`), bajo el grupo `TGroup.LOGS_SLAVE`. Singleton por proceso
(`SlaveSpec.get(config)`, con `_INSTANCE` cacheada). Solo se activa si
`config.status.enabled` es `true` (`StatusConfig`, ver `modules/utiles/config.ts`); si no,
`buildMonitors()` es un no-op (comprobado en la clase base `LogsSpec`, no en este
workspace). El único monitor que construye (`buildWorkspaceMonitors`) es "Elasticsearch",
en OK/error según si `cluster.elastic.current_publish.errors` tiene elementos — y ese
array **solo lo rellena `ingestError`** (ver asimetría arriba); un fallo publicando logs de
servicio no lo toca.

## `Engine` (`modules/engine.ts`)

Extiende `Engine` HTTP de `@mr/core-workload/engine/server`:

```
Engine extends EngineServer<Configuracion>
  ejecutar()  → registra [Slave(config)] en initWebServer() y delega en super.ejecutar()
```

No sobreescribe `ok()`: usa el no-op de la clase base
(`@mr/core-workload/engine/server.ts`). A diferencia de `status-external` (que comprueba
`elasticsearch.info()` en su healthcheck), este servicio no verifica activamente la
conexión a Elasticsearch pese a ser su único backend de escritura.

## `Configuracion` (`modules/utiles/config.ts`)

Extiende `Configuracion` de `services-comun-status/modules/config/service` (que a su vez
extiende `ConfiguracionNet` de `@mr/core-workload/config/net`, con el mapa `SERVICES` de
`framework/services-comun-status/modules/services/config.ts` para resolución de
endpoints). Añade una única propiedad propia, `status: StatusConfig`
(`logs-status-base/modules/utiles/config`, `{enabled, server}`), con los valores por
defecto de `CONFIG_STATUS_DEFECTO` (`services-comun/modules/status/utiles/config.ts`) —
es la config que consulta `SlaveSpec.get()` para decidir si auto-monitorizarse.

## Dependencias

- **Runtime:** `@elastic/elasticsearch`, `chokidar`, `dd-trace`, `formidable`, `hexoid`,
  `mysql2`, `qs`, `source-map-support`, `tslib`, `ws` (+ `bufferutil` opcional).
  `mysql2` y `formidable` están declarados pero no se ha encontrado ningún import directo
  desde `modules/**` de este workspace; se documentan tal cual figuran en `package.json`,
  sin asumir un uso que no se ha verificado en las fuentes.
- **Workspaces del monorepo** (`devDependencies`):
  - `@mr/core-dev` — tsconfig base.
  - `@mr/core-i18n`, `@mr/core-network`, `@mr/core-workload` — router HTTP
    (`RouteGroup`), `Engine` HTTP, `Main.ejecutar`.
  - `logs-services` (dir `packages/logs-services`) — clases `Log`/`Error`, forma de
    documento ES, nombres de índice/alias. Desde que se retiró `services/logs` es su
    **único** consumidor, pero el mismo contrato lo declara aparte el framework, que es de
    donde lo lee `status-backend` (ver "Quién lee lo que se escribe aquí").
  - `logs-status-base` (dir `packages/status-base`) — `LogsSpec`, `TGroup`, `StatusConfig`;
    auto-monitorización contra el panel Status.
  - `services-comun` — logging, `elastic`, `BulkAuto`/`Deferred`, config base de status.
  - `services-comun-status` — `Configuracion` base, `EService`/`SERVICES`, tsconfig base
    del dominio.

## Flujo de una petición típica

```text
Servicio monitorizado (otro workspace)
  -> POST /service/logs/service/  {proyecto, servicio, tipo, severidad, mensaje, extra?}
  -> Slave.getHandlers()[0].handler
       - conexion.noCache()
       - await this.sendRespuesta(conexion)   -- 200 {ok:true} YA enviado
       - ingestLog(post)                      -- sin await, sin captura de error
            - new Log(...) -> BULK.create({index: mr-log-servicios-<proyecto>, doc})

Servicio monitorizado
  -> POST /service/logs/error/  {proyecto, servicio, url, mensaje, archivo, linea, ...}
  -> Slave.getHandlers()[1].handler
       - conexion.noCache()
       - await this.sendRespuesta(conexion)   -- 200 {ok:true} YA enviado
       - ingestError(post, config)            -- sin await
            - new Error(...) -> BULK.create({index: mr-log-errores-<proyecto>, doc})
                 .promise.catch -> SlaveSpec: registra el fallo y republica el monitor
                                    "Elasticsearch" en el panel Status

(en paralelo, sin relación directa con esta petición)
services/logs
  -> GET/POST /backend/logs/... (BFF de status-frontend)
  -> LogServicio.search / LogError.search  -- sobre los mismos alias mr-log-servicios /
     mr-log-errores que acaba de escribir logs-web
```

## Mantenimiento

Si se añade un nuevo tipo de log o un nuevo campo:

1. Definir la forma del documento en `logs-services` (`packages/logs-services/modules/data/*`),
   no en este workspace ni en `services/logs`: ambos servicios dependen de esa única fuente.
2. Actualizar el handler correspondiente en `modules/net/handlers/slave.ts` y su interfaz
   `ILog*POST` local (el `POST` que llega del cliente puede no coincidir 1:1 con el
   documento ES; hoy sí coinciden salvo por `timestamp`/`checked`, que añade `ingest()`).
3. Si el cambio afecta a los índices o alias, revisar `services/logs` (consultas) y
   cualquier mapping de Elasticsearch en `mapping/` en la raíz del monorepo, si existe uno
   para estos índices.
4. Actualizar esta sección y la tabla de "Superficie pública" de este CODEMAP.
