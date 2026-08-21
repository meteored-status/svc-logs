# CODEMAP — `logs-services`

Mapa técnico del workspace `packages/logs-services/`.

## Objetivo

Entidades de acceso a datos del dominio de logs aplicativos (no de accesos web, esos son otro
dominio: ver `logs-worker-*`/`workers-accesos-*` de `workers-base`). Dos clases hermanas, cada una
con su propio índice de Elasticsearch: `Log` (logs de servicio: eventos con severidad) y `Error`
(errores de aplicación con traza y contexto). Lo consume **un solo workspace**, `services/logs-web` (la ingesta): no hay
cronjobs ni otro `packages/*` en este repo que lo importen. Tenía un segundo consumidor,
`services/logs` (la consulta), retirado al pasar los listados del panel a `status-backend` en el repo
`svc-status` — ver el README de la raíz. Los `getAlias()` de aquí siguen describiendo lo que ese otro
servicio lee, pero él no importa este paquete: su copia del contrato vive en el framework compartido
(`services-comun-status/modules/services/logs/logs/elastic.ts`), y las dos tienen que decir lo mismo.

Cada clase resuelve dos destinos distintos según la operación:

- **Escritura → un índice por proyecto.** `getIndex(proyecto)` devuelve
  `mr-log-servicios-<proyecto>` / `mr-log-errores-<proyecto>` (proyecto en minúsculas). Es el
  índice físico donde se indexa cada documento nuevo.
- **Lectura → un nombre fijo, sin proyecto.** `getAlias()` devuelve siempre el mismo literal
  (`mr-log-servicios` / `mr-log-errores`), sin sufijo. Ver la sección de abajo: cómo se resuelve
  esto es una incógnita parcial de este mapa.

## Árbol de módulos

```text
packages/logs-services/
├─ modules/
│  └─ data/
│     ├─ servicio.ts    — Log (logs de servicio) + ILogServicioES
│     └─ error.ts       — Error (logs de error) + ILogErrorCTX/ILogErrorES
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json          — nombre de paquete: "logs-services" (coincide con el directorio)
└─ tsconfig.json         — extiende services-comun-status/tsconfig.json
```

No hay `README.md`, `modules/net/` ni `modules/utiles/`: el paquete es solo estas dos entidades,
sin configuración ni transporte propios.

## Superficie pública

### `modules/data/servicio.ts` → `logs-services/modules/data/servicio`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `ILogServicioES` | `interface` | Forma del documento tal como se persiste/lee en Elasticsearch: `{"@timestamp": string, proyecto, servicio, tipo, severidad, mensaje, extra?: string\|string[]}`. `extra` es `undefined` si el array de entrada está vacío — no se guarda `[]`. |
| `Log` | `class` | Log de servicio (evento con severidad). Constructor recibe `ILogServicio` (con `timestamp: Date` en vez de `"@timestamp"` string) directamente — no hay `build()` ni factory, cualquiera puede instanciarlo. Getters de solo lectura para los siete campos; `toJSON()` produce el `ILogServicioES` a partir del estado interno. |
| `Log.getIndex(proyecto)` | `static` | `mr-log-servicios-<proyecto.toLowerCase()>` — el índice de **escritura**, uno por proyecto. |
| `Log.getAlias()` | `static` | `"mr-log-servicios"`, sin argumentos ni sufijo — el destino de **lectura**. Ver "Cómo se resuelve el destino de lectura" más abajo. |
| `Log.BULK` | `static readonly BulkAuto` | Cola de escritura automática (`services-comun/modules/elasticsearch/bulk/auto`) hacia el cliente Elasticsearch compartido (`services-comun/modules/utiles/elastic`), arrancada en un bloque `static {}` — es decir, **se pone en marcha solo con importar el módulo**, aunque nadie llegue a usarla. Ningún consumidor de este paquete la referencia (`Log.BULK`): tanto `services/logs-web/modules/data/servicio.ts` como el resto del código encontrado crean su **propia** instancia de `BulkAuto` en vez de reusar esta. Es decir: tal como está el código hoy, es una segunda cola en marcha que no envía nada — no se ha encontrado ningún sitio que le llame `.create()`/`.index()`/etc. `Error` (el fichero hermano) no tiene un `BULK` equivalente: la asimetría entre las dos clases es real, no un error de lectura de este mapa. |

### `modules/data/error.ts` → `logs-services/modules/data/error`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `ILogErrorCTX` | `interface` | `{linea: number, codigo: string}` — un fotograma de contexto del error (línea + código fuente alrededor). |
| `ILogErrorES` | `interface` | Forma del documento en Elasticsearch: `{"@timestamp", checked, proyecto, servicio, url, mensaje, archivo, linea, traza?: string\|string[], ctx?: ILogErrorCTX\|ILogErrorCTX[]}`. Igual que `Log`, `traza`/`ctx` se omiten (no `[]`) cuando el array de entrada está vacío. |
| `Error` | `class` | Error de aplicación. Mismo patrón que `Log`: constructor público con el dato ya tipado (`ILogError`, con `linea: string` — ver ojo más abajo), getters de solo lectura, `toJSON()`. **No** tiene ningún `BULK` propio. |
| `Error.getIndex(proyecto)` | `static` | `mr-log-errores-<proyecto.toLowerCase()>` — índice de escritura, uno por proyecto. |
| `Error.getAlias()` | `static` | `"mr-log-errores"` — destino de lectura, mismo mecanismo (e incógnita) que `Log.getAlias()`. |

Ojo con `linea`: en la entidad es `string` (`ILogError.linea: string`, `ILogErrorES.linea: string`),
pero en la plantilla de mapeo (`mapping/logs/log-errores-mappings.json`) el campo `linea` está
tipado como Elasticsearch `integer`. Elasticsearch admite indexar una cadena numérica en un campo
`integer` (la coacciona), así que no rompe, pero cualquier consulta que trate `linea` como texto
(un `wildcard`, por ejemplo) no funcionaría como con un `keyword`.

### Nombres de índice y `checked`: quién hace qué con ellos (fuera de este paquete)

Ninguna de las dos clases sabe filtrar, paginar ni borrar — eso vive en los consumidores (ver
"Consumidores directos"). Dos detalles de esos consumidores que conviene tener presentes al leer
este paquete, porque son la razón de ser de algunos de sus campos:

- `checked` en `ILogErrorES` nace siempre en `false` al hacer `ingest` (`services/logs-web`). Quien
  lo pone en `true` es `status-backend`, en el repo `svc-status` (`RegistroError.marcar()`): un
  `updateByQuery` con `script: "ctx._source.checked = true"`. Es decir, «borrar un error» en el panel
  es marcarlo como revisado, no eliminar el documento — allí el endpoint, el permiso y el apunte de
  auditoría se llaman `check` justamente por eso. Al tocar este índice conviene no perder de vista que
  los listados filtran ya por `checked: false` (solo pendientes).
- `Log` (logs de servicio) no tiene ningún campo equivalente a `checked`: todo lo escrito queda
  visible siempre, no hay noción de "revisado" en ese índice.

## Cómo se resuelve el destino de lectura (`getAlias()`) — incógnita

`getAlias()` devuelve un nombre **fijo, sin proyecto** (`mr-log-servicios` / `mr-log-errores`),
mientras que `getIndex(proyecto)` siempre lleva el proyecto como sufijo. Para que una búsqueda
contra `getAlias()` (lo que hacen las consultas de `status-backend`)
llegue a los documentos escritos en `mr-log-servicios-<proyecto>`/`mr-log-errores-<proyecto>`,
tiene que existir en el clúster de Elasticsearch un **alias** con exactamente ese nombre fijo que
abarque todos los índices por proyecto — o una convención equivalente (patrón de índice, alias de
lectura configurado aparte, etc.).

Dos piezas de evidencia indirecta que apuntan a que este es el diseño (no una prueba, no se ha
podido verificar contra el clúster real):

1. **`mapping/logs/log-servicios-mappings.json` y `log-errores-mappings.json` tipan `proyecto`
   como `constant_keyword`**, no `keyword`. Ese tipo existe justo para este patrón: un valor fijo
   e idéntico en todos los documentos de un mismo índice, que permite a Elasticsearch descartar
   índices enteros de una búsqueda con `terms`/`term` sobre ese campo sin llegar a abrirlos —
   exactamente lo que hace falta para que consultar por `proyecto` contra un alias que agrupa
   *muchos* índices (uno por proyecto) sea barato.
2. Las consultas de lectura (hoy `RegistroServicio` y `RegistroError` en `status-backend`, del repo
   `svc-status`; antes `LogServicio`/`LogError` de `services/logs`) **sí** filtran siempre por
   `terms: {proyecto: projects}` además de usar el alias como índice — sin ese filtro, leer por el
   alias mezclaría los proyectos sin poder distinguirlos en la consulta.

Lo que **no** se ha encontrado en este repositorio es el código o la plantilla que crea o mantiene
ese alias: no hay ningún `index_patterns`/`aliases` en `mapping/logs/*.json` (solo `settings` y
`mappings` de cada índice), ni ningún script de bootstrap. O bien se provisiona fuera de este
repositorio (a mano, o desde otra pieza de infraestructura), o bien el mecanismo real es otro que
no se ha localizado. Cualquier cambio en las consultas que dependa de esto debería confirmarse
contra el clúster antes de asumir el comportamiento descrito arriba.

Las plantillas de índice tampoco coinciden entre sí en el nombre de la política de ILM:
`log-errores-settings.json` usa `index.lifecycle.name: "log-errores"` (español, coincide con el
nombre base) pero `log-servicios-settings.json` usa `index.lifecycle.name: "log-services"`
(inglés, no coincide con `mr-log-servicios`). No se ha podido confirmar si son dos políticas de
ILM realmente distintas en el clúster o un desajuste de nombre sin consecuencia.

## Dependencias

`devDependencies` declaradas en `package.json`:

- `@elastic/elasticsearch` — tipos del cliente (`services-comun/modules/utiles/elastic` es quien
  lo envuelve; este paquete no instancia el cliente, solo usa sus tipos indirectamente a través de
  `BulkAuto`).
- `@types/node`
- `services-comun` (workspace) — `modules/elasticsearch/bulk/auto` (`BulkAuto`) y
  `modules/utiles/elastic` (cliente Elasticsearch compartido).
- `services-comun-status` (workspace) — de aquí extiende su `tsconfig.json`; no se ha encontrado
  ningún import directo de sus módulos en el código de este paquete.
- `tslib`

## Consumidores directos

| Paquete | Ficheros consumidores | Uso |
|---------|------------------------|-----|
| `services/logs-web` | `modules/data/servicio.ts` (función `ingest`), `modules/data/error.ts` (función `ingest`) | Solo **escritura**. Cada `ingest()` construye una instancia (`new Log(...)`/`new Error(...)`) y la encola con `BULK.create({index: Log.getIndex(documento.proyecto), doc: documento.toJSON()})` — su **propia** cola `BulkAuto`, no `Log.BULK`. El `ingest` de error, además, si falla el `create`, registra el fallo en el spec de status (`services/logs-web/modules/data/status.ts`, que a su vez depende de `logs-status-base`, ver el CODEMAP de ese paquete) para que se refleje en el panel de status. |

`services/logs-slave` y `services/workers-slave` no declaran ni importan `logs-services`.

**El lector ya no es un consumidor de este paquete.** Las consultas las hace `status-backend` (repo
`svc-status`), que tipa y nombra los índices con su propia copia del contrato en el framework
compartido (`services-comun-status/modules/services/logs/logs/elastic.ts`) en lugar de importar
`logs-services`, que es un paquete local de este repo. Son dos declaraciones del **mismo** documento y
de los **mismos** alias: si una cambia y la otra no, la ingesta y la consulta dejan de entenderse sin
que nada falle al compilar.

## Flujo de uso típico

```text
Escritura (services/logs-web)
  ingest(data)
    -> new Log(...)/new Error(...)              (logs-services)
    -> BULK.create({index: getIndex(proyecto), doc: documento.toJSON()})
                                                   índice físico mr-log-{servicios,errores}-<proyecto>

Lectura (status-backend, repo svc-status — ya no pasa por este paquete)
  RegistroServicio.search(...) / RegistroError.search(...)
    -> elastic.search({index: LOG_{SERVICIOS,ERRORES}_ALIAS, query: {bool: {filter: [{terms: {proyecto: ...}}, ...]}}})
                                                   nombre fijo, sin proyecto — ver incógnita arriba
    -> se publica el documento tal cual, sin reconstruir entidad
```

## Mantenimiento

Si se toca alguna de las dos entidades:

1. Mantener el paralelismo entre `Log` y `Error` a propósito o documentar por qué se rompe: hoy
   comparten estructura (`getIndex`/`getAlias`/getters/`toJSON`) salvo por `Log.BULK`, que parece
   dead code (ver arriba) y no una asimetría intencional confirmada.
2. Antes de cambiar cualquier consulta que dependa de `getAlias()`, confirmar contra el clúster de
   Elasticsearch real cómo está resuelto ese alias — este mapa documenta indicios (`constant_keyword`
   en `proyecto`, el filtro `terms` en los consumidores) pero no ha podido verificar la pieza que
   crea o mantiene el alias.
3. Si se añade un campo nuevo al documento, actualizar en paralelo la plantilla de mapeo
   correspondiente en `mapping/logs/{log-servicios,log-errores}-mappings.json` — de lo contrario el
   campo llega a Elasticsearch sin tipo explícito (mapeo dinámico) y puede acabar con un tipo
   distinto al que espera `toJSON()`.
4. Actualizar la tabla de "Superficie pública" y, si cambia algún consumidor, la de "Consumidores
   directos" en este CODEMAP.
