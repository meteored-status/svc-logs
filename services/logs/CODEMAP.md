# CODEMAP — `logs`

Mapa técnico del workspace `services/logs/`.

## Objetivo

Servicio HTTP interno: **el lado lectura** de la plataforma de logs. Expone bajo
`/private/logs/*` la consulta de los logs de servicio y de los logs de error que
otro workspace de este mismo monorepo (`services/logs-web`) ingiere en
Elasticsearch. No escribe logs, no los recibe: solo consulta.

Su cliente es el panel de Status, que llega a través del backend de `svc-status`
usando los clientes tipados de `services-comun-status/modules/services/logs/logs/*`.

El servicio es deliberadamente pequeño —7 ficheros `.ts`— porque casi todo lo que
necesita se lo dan el framework (`@mr/core-*`, `services-comun`) y el paquete de
datos compartido `logs-services`.

**Dos cosas que hay que entender antes de leer el resto**, porque explican casi
todas las decisiones:

1. **Los errores son una bandeja de trabajo; los logs de servicio, un histórico.**
   Todas las consultas de errores llevan `{term: {checked: false}}` **cableado**, y
   el mal llamado `delete` no borra: marca `checked = true`. Los logs de servicio no
   tienen ese concepto —el campo no existe en su mapping— y no se pueden marcar ni
   borrar.
2. **Un índice físico por proyecto, y un alias fijo para leerlos todos juntos.** Lo
   impone el mapping, no una optimización: `proyecto` es `constant_keyword`, que
   solo admite un valor por índice. `logs-web` escribe en
   `mr-log-{errores,servicios}-<proyecto>` y este servicio lee siempre del alias
   `mr-log-{errores,servicios}`.

## Árbol de módulos

```text
services/logs/
├─ modules/
│  ├─ engine.ts                    — Engine: registra los 2 RouteGroup y define ok()
│  ├─ utiles/
│  │  └─ config.ts                 — re-export de Configuracion (services-comun-status); no añade nada propio
│  ├─ net/
│  │  └─ handlers/
│  │     ├─ error.ts               — Error: GET list, GET available-filters, POST delete
│  │     └─ servicio.ts            — Servicio: GET list, GET available-filters
│  └─ data/
│     └─ log/
│        ├─ log-error.ts           — LogError: search, filterValues, delete (sobre el alias de errores)
│        └─ servicio.ts            — LogServicio: search, filterValues (sobre el alias de servicios)
├─ files/
│  └─ credenciales/                 — credenciales de servicio (elastic.json, services.json, mysql.json);
│                                     contenido sensible, no leer. Ojo: hay un `mysql.json` y este
│                                     servicio no toca MySQL — ver la deuda del `mrpack.json`
├─ output/                          — código compilado (esbuild); generado, sin valor documental
├─ main.ts                          — Main.ejecutar(Engine, Configuracion)
├─ app.js                           — bootstrap runtime (source-map-support, Datadog, require("./output/app"))
├─ devel.js                         — bootstrap de desarrollo (TZ=UTC, require("./app"))
├─ mrpack.json                      — config de despliegue (K8s, esbuild, framework "meteored")
├─ CHANGELOG.md
├─ package.json
├─ tsconfig.json
└─ tsconfig.tsbuildinfo             — caché incremental de TypeScript; no leer/documentar
```

## Arranque

`main.ts` son cuatro líneas: `Main.ejecutar(Engine, Configuracion)`.

`modules/engine.ts` registra los dos grupos de rutas y define el healthcheck:

```ts
public override async ejecutar(): Promise<void> {
    this.initWebServer([
        Error(this.configuracion),
        Servicio(this.configuracion)
    ], this.configuracion.net);
    await super.ejecutar();
}

protected override async ok(): Promise<void> {
    await elasticsearch.info();
}
```

Tres consecuencias que no se ven en ese código:

- **`initWebServer` añade solo dos handlers más**, `admin` y `favicon`, así que el
  servicio expone además `/admin/{started,ready,live,check,doc,metrics}` sin
  declararlas.
- **`ok()` cuelga de Elasticsearch, y las tres probes de Kubernetes cuelgan de
  `ok()`**: si el clúster no responde, el pod no se declara vivo, no solo «no
  listo».
- **Sobreescribe `ejecutar()` y no `init()`**, que es el punto de extensión que
  documenta el framework. Funciona —el `init()` base sigue montando el watcher de
  shutdown—, pero es una desviación del patrón.

`modules/utiles/config.ts` es una sola línea: re-exporta la `Configuracion` de
`services-comun-status`, que **no añade ningún campo propio**. Toda la
configuración de red sale del registro de servicios (`switch-svc-logs`, namespace
`services`), no de este workspace: aquí no se sobreescribe ni un puerto ni un
timeout.

## Superficie pública — rutas HTTP

Todas van bajo `/private/*` y todas están marcadas `internal: true`. Ojo: **ese
flag no lo hace cumplir nada en runtime**; se guarda y se documenta, pero quien
garantiza que no se llegue de fuera es la topología de red, no el código.

| Handler | Método | Ruta | Data | Descripción |
|---------|--------|------|------|-------------|
| `Servicio` | GET | `/private/logs/servicio/list/` | `LogServicio.search` | Página de logs de servicio, del más reciente al más antiguo. Filtros por query string: `projects` (obligatorio), `severity`, `services`, `types`, `ts_from`/`ts_to`, y paginación `page`/`perPage`. Devuelve `total`, `reachable` y `histogram` además de los registros |
| `Servicio` | GET | `/private/logs/servicio/available-filters/` | `LogServicio.filterValues` | Valores disponibles de los filtros (`services`, `types`) para unos proyectos |
| `Error` | GET | `/private/logs/error/list/` | `LogError.search` | Igual, para errores. Sus filtros son otros: `services`, `urls`, `lines`, `files` — no hay `severity` ni `types`. **Solo devuelve los no revisados** |
| `Error` | GET | `/private/logs/error/available-filters/` | `LogError.filterValues` | Valores disponibles (`services`, `urls`, `files`, `lines`), también solo de los no revisados |
| `Error` | POST | `/private/logs/error/delete/` | `LogError.delete` | **No borra: marca como revisados** (`checked = true`). Ver la advertencia de abajo |

Los dos handlers siguen el patrón del monorepo: clase que extiende `RouteGroup`,
métodos `handleX` privados, `getHandlers()` con la tabla de rutas, y un export por
defecto que es una factoría *singleton* (`instance ??= new X(config)`).

### ⚠️ `POST /private/logs/error/delete/` marca un proyecto entero

Es la operación más destructiva del servicio y la que menos se valida:

- La única comprobación es `if (!post || !post.project?.length)`. El resto de
  campos —`ts`, `service`, `file`, `line`, `url`— son opcionales, así que **una
  petición con solo `project` marca como revisados todos los errores de ese
  proyecto**.
- La ruta **no declara ni `query` ni `post`**, así que no hay validación de esquema
  del cuerpo en el routing.
- El nombre engaña en las cuatro capas: la ruta se llama `/delete/`, el método
  `delete()`, el contrato `IDeleteIN`/`IDeleteOUT` y el campo de respuesta
  `deleted`. Lo que hace es un *acknowledge*: `updateByQuery` con
  `script: "ctx._source.checked = true"` y `refresh: true`. Solo el JSDoc del
  método lo cuenta bien.
- Tampoco filtra por `checked: false`, así que re-marca lo ya marcado e infla el
  `deleted` que devuelve.

### Las regex de la query prometen más de lo que validan

Cada ruta declara un bloque `query:` con expresiones por parámetro. Se leen como
un esquema, pero **ninguna está anclada** (`^…$`) y el checker hace `regex.test()`,
así que solo comprueban que el valor *contenga* algo que case:
`/[a-z]+(?:(?:;[a-z]+)?)+/` no valida «lista de identificadores separados por `;`»,
valida «tiene al menos una minúscula».

No es un agujero de inyección —las consultas se montan como objetos, no como
texto—, pero sí es validación aparente: al tocarlas, no se puede dar por hecho que
lo que llega al handler tenga la forma que sugiere la regex.

Hay además un caso que se salva por accidente: `urls` valida con `[A-Z\d\/.:]+`,
en **mayúsculas**, contra URLs que en la práctica son minúsculas. Solo pasa porque
las regex no están ancladas y cualquier URL contiene `/`, `.` o `:`. Si alguien
ancla las expresiones sin mirar, ese filtro deja de funcionar.

## Capa de datos — `modules/data/log/*`

Dos clases estáticas, sin instancias, una por tipo de log. El modelo del documento
y la resolución del índice **no** están aquí: vienen de `logs-services`
(`packages/logs-services`), que es lo que este servicio comparte con
`services/logs-web`.

### Cómo se resuelve el destino de lectura

```ts
// packages/logs-services/modules/data/error.ts
private static INDEX = "mr-log-errores";
public static getIndex(proyecto: string): string { return `${this.INDEX}-${proyecto.toLowerCase()}`; }
public static getAlias(): string { return this.INDEX; }
```

- `logs-web` **escribe** con `getIndex(proyecto)` → un índice por proyecto.
- `services/logs` **lee** siempre con `getAlias()` → los cinco `search`/`filterValues`
  consultan el alias, nunca un índice concreto.

Y el motivo de que sea así: `proyecto` está mapeado como **`constant_keyword`**, que
admite un único valor por índice. La partición por proyecto no es una optimización
que se pueda deshacer, es lo que el mapping exige; y el alias es lo que permite que
el `terms: {proyecto: projects}` multi-proyecto de las consultas tenga sentido.

**Nada en este repo crea el alias, los índices, las plantillas ni las políticas
ILM.** Los JSON de `mapping/logs/` son DDL para aplicar a mano; el ciclo de vida
cuelga de una política ILM referenciada por nombre en los `*-settings.json`.

### `LogError` (`log-error.ts`)

| Símbolo | Descripción |
|---------|-------------|
| `search(filter, {page, perPage})` | Página de errores no revisados, ordenada por `@timestamp` descendente, más `total`, `reachable` e `histogram`. Todo de **una sola** consulta |
| `filterValues(projects)` | Los valores que puede tomar cada filtro, con cuatro agregaciones `terms` en una consulta con `size: 0` |
| `delete(request)` | Marca como revisados (ver la advertencia de arriba) |
| `ISearchResult` | Lo que devuelve `search`: `{logs, total, reachable, histogram}` |

El `must` de `search` lleva dos cláusulas fijas —`{terms: {proyecto}}` y
`{term: {checked: false}}`— y añade `terms` opcionales por `servicio`, `url`,
`linea` y `archivo`, más un `range` sobre `@timestamp`.

Al mapear los hits normaliza `traza` y `ctx` con
`data.x ? (Array.isArray(data.x) ? data.x : [data.x]) : []`, y no es paranoia: el
productor omite el campo cuando está vacío, y Elasticsearch devuelve escalar o
array según lo que haya.

### `LogServicio` (`servicio.ts`)

| Símbolo | Descripción |
|---------|-------------|
| `search(filter, {page, perPage})` | Igual que su gemelo, sobre el alias de logs de servicio y **sin** el filtro de `checked` |
| `filterValues(projects)` | Dos agregaciones `terms`: `by-servicio` y `by-tipo` |
| `ISearchResult` | `{logs, total, reachable, histogram}` |

Es el gemelo de `LogError`, escrito dos veces. Las diferencias que importan están
en la sección de deuda, más abajo: no son de dominio, son de cuidado desigual.

### Paginación, total y distribución

Los tres salen de la misma consulta, y cada uno tiene su motivo:

- **`total`** necesita `track_total_hits: true`. Sin él Elasticsearch deja de
  contar en 10.000 y el paginador no sabría cuántas páginas hay. Cuesta contar el
  índice filtrado, no traérselo.
- **`reachable`** existe porque se pagina con `from`/`size`, y eso está sujeto a
  `index.max_result_window` (10.000): más allá de ese registro no se llega pasando
  páginas, hay que acotar el filtro. Se calcula contra la última página
  **completa** (`floor(10000/perPage)*perPage`) y no contra los 10.000 pelados: con
  30 por página la última acaba en el 9.990, y redondear al alza ofrecería al
  paginador una página que no existe.

  Va aparte de `total` a propósito: el paginador necesita `reachable` y el rótulo
  necesita `total`. Con `total` en el paginador se ofrecerían páginas que el
  servicio no puede servir; recortando `total` no se vería cuántos registros
  quedan fuera de alcance.
- **`histogram`** es un `auto_date_histogram` sobre `@timestamp`, con un techo de 32
  tramos. Es `auto_` y no `date_histogram` porque la anchura la elige
  Elasticsearch y la devuelve: el rango depende de lo que filtre quien pregunta —de
  diez minutos a meses—, así que una anchura fija daría tramos absurdos en los
  extremos.

  Es lo único de la respuesta que **no** está limitado por la ventana de
  resultados: una agregación cuenta sobre todo lo que casa con el filtro. Por eso
  la gráfica del panel se alimenta de aquí y no de los registros de la página.

**La respuesta no dice qué página se sirvió de verdad.** `search()` recorta la página
pedida a la última alcanzable, pero `IListOUT` no devuelve `page`/`perPage`
normalizados —a diferencia del listado de auditoría de `status-backend`, que sí lo
hace—, así que un cliente que pida la página 9.999 recibe la última **sin enterarse
de que le han cambiado la página**. Hoy no pasa desde el panel, porque su paginador
cuenta con `reachable` y no ofrece páginas fuera de alcance; pero cualquier otro
consumidor —o una URL a mano— se lo puede encontrar. Devolver los dos valores
normalizados es la forma de cerrarlo, y significa tocar el contrato.

El `perPage` por defecto sigue siendo **15**, el de siempre, para no cambiarle la
respuesta a quien no lo pide. Lo que se añadió es el techo (`PER_PAGE_MAX`, 200) y
el recorte de la página a la última alcanzable: antes, pedir una página más allá de
la ventana devolvía una lista vacía **indistinguible de «no hay datos»**.

`PER_PAGE_MAX`, `MAX_RESULT_WINDOW` e `IHistogram` viven en el contrato compartido
(`services-comun-status/modules/services/logs/logs/interface.ts`), junto a
`ESeverity`, porque los usan los dos listados y el consumidor.

## Contrato — `services-comun-status/modules/services/logs/**`

Un directorio por endpoint, con su `interface.ts` (`I*IN`/`I*OUT`), y un `index.ts`
por familia que es el **cliente** tipado (`BackendRequest`) que usa el consumidor.
Lo compartido entre los dos listados está en `logs/logs/interface.ts`.

### Asimetrías del contrato que no son casualidad

- **Errores tiene tres endpoints; servicios, dos.** No hay `delete` de logs de
  servicio porque no hay `checked`: son historial, no bandeja.
- **Los `ILog` divergen**: errores lleva `url`, `line`, `file`, `trace`, `ctx[]`;
  servicios lleva `type` y `severity`. Los ejes de filtrado de cada uno salen de
  ahí.
- **`extra` de los logs de servicio se lee de Elasticsearch, se normaliza a array
  y se tira**: el contrato no lo expone. Trabajo hecho para nada, o un campo a
  medio publicar.
- **`linea` y `severidad` cambian de tipo por el camino**: `integer`/`keyword` en
  Elasticsearch, `string` en el modelo, y `parseInt` en el handler. El productor los
  escribe como texto.
- **El cliente nunca manda `perPage` sin `page`** (está anidado en su `if`), pero el
  servicio acepta `perPage` suelto: el contrato es más estrecho que la
  implementación.

## Dependencias

- **Runtime**: `@elastic/elasticsearch`, `dd-trace`, `qs`, `ws`, `formidable`,
  `source-map-support`, `tslib`.
- **Workspaces**: `@mr/core-{dev,i18n,network,workload}` (tsconfig, routing HTTP,
  `Main`/`Engine`), `services-comun` (cliente de Elasticsearch y logging),
  `services-comun-status` (contrato de los endpoints y `Configuracion`) y
  `logs-services` (el modelo del documento y la resolución de índice/alias, que
  comparte con `services/logs-web`).

Relación con el resto del repo: **`services/logs-web` es el productor** de los dos
índices que este servicio lee, y el otro extremo del `checked: false`
(pone `checked: false` en cada error que ingiere). `services/logs-slave` y
`services/workers-slave` procesan accesos de Cloudflare hacia BigQuery y no
comparten datos con este servicio, aunque sus descripciones se parezcan.

## Deuda y trampas conocidas

Nada de esto es urgente, pero está aquí para que no se descubra dos veces:

1. **`filterValues` no está igual de blindado en los dos ficheros.** El de errores
   extrae los buckets con `?.` y `|| []`; el de servicios hace
   `aggregations?.['by-servicio'].buckets` y llama `.map` sobre el resultado. Si
   Elasticsearch no devuelve agregaciones, el de servicios revienta con un
   `TypeError` y responde 500; el de errores devuelve listas vacías. Mismo código
   escrito dos veces con distinto cuidado.
2. **Guardas de array vacío distintas**: errores hace `if (filter.servicio)` —un
   array vacío es *truthy*, así que produce `{terms: {servicio: []}}`—, servicios
   comprueba además `length > 0`.
3. **`term` contra `terms` sin criterio**: `severidad` se filtra con `term`
   singular, así que no se puede pedir «severidad 2 o 3» aunque todos los demás
   ejes sean multivalor.
4. **Importar `Log` levanta un `BulkAuto` de escritura que este servicio nunca
   usa**: `logs-services/modules/data/servicio.ts` lo arranca en un bloque
   `static {}`, así que el simple import lo pone en marcha con su temporizador. El
   `error.ts` del mismo paquete no lo hace.
5. **`class Error extends RouteGroup` sombrea el `Error` global**, y el
   `import {Error}` de `logs-services` lo sombrea otra vez en la capa de datos. Hoy
   no hay ningún `new Error()` ni `instanceof Error` en esos ficheros, pero
   cualquier `catch (e) { if (e instanceof Error) }` que se añada ahí se portará de
   forma inesperada.
6. **`mrpack.json` declara una base de datos `logs`** que este servicio no usa: no
   tiene `mysql2` ni una línea de MySQL. Es configuración heredada por copia; la
   base es de `logs-slave`/`logs-web`. Y no es solo el manifiesto: por eso hay un
   `files/credenciales/mysql.json` desplegado en un servicio que nunca abre una
   conexión. Credenciales de más en un pod es lo que hay que quitar primero si
   alguna vez se limpia esto.
7. **`available-filters` trunca en silencio** (`size: 100` para servicio/archivo/tipo,
   `500` para línea/url) y la respuesta no tiene forma de decir «hay más», así que
   un proyecto con mucha cardinalidad ofrece un filtro incompleto sin avisar.
8. **`mensaje` y `traza` de los errores son `index: false`**: no hay —ni puede
   haber— búsqueda por el texto del error, y de ahí que se filtre por
   servicio/archivo/línea/url. En los logs de servicio, en cambio, `mensaje` sí es
   buscable (`keyword` + subcampo `.text`) y **ningún endpoint lo aprovecha**.
9. **Las políticas ILM no cuadran de nombre**: los settings de errores apuntan a
   `log-errores` y los de servicios a `log-services` —mitad castellano, mitad
   inglés—, y ninguno coincide con el nombre del índice. Con un índice por proyecto
   y sin rollover ni sufijo temporal, todo el ciclo de vida cuelga de eso.
10. **Los tipos de Elasticsearch se importan por dos rutas distintas** en ficheros
    hermanos (`services-comun/modules/utiles/elastic` en errores,
    `services-comun/modules/elasticsearch` en servicios). Funciona porque el
    primero reexporta el segundo.

## Mantenimiento

Si se añade o se cambia un endpoint:

1. Definir o actualizar la interfaz en
   `services-comun-status/modules/services/logs/logs/<area>/<accion>/interface.ts`.
   Si lo que se añade lo comparten los dos listados, va en `logs/logs/interface.ts`.
2. Tocar la consulta en `modules/data/log/*`, recordando que hay **dos** ficheros
   gemelos y que casi todo lo que se cambie en uno hay que valorarlo en el otro.
3. Dar de alta la ruta en el `RouteGroup` de `modules/net/handlers/*`, con su
   bloque `query:` — y sabiendo lo que ese bloque valida de verdad (ver arriba).
4. `services-comun-status` es un paquete de **framework**: sus cambios se envían con
   `yarn mrpack framework --send`, y hasta que eso ocurra el consumidor no los ve.
