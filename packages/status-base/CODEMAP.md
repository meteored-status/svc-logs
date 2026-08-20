# CODEMAP — `status-base`

Mapa técnico del workspace `packages/status-base/`.

> **Ojo con el nombre**: el directorio es `packages/status-base/`, pero el paquete npm se llama
> **`logs-status-base`** (`package.json#name`), no `status-base`. Todo import externo usa
> `logs-status-base/...`; el nombre `status-base` solo aparece como ruta de directorio y como
> script raíz (`yarn run status-base` → `yarn workspace status-base`, que en realidad no coincide
> con el nombre real del paquete — ver "Mantenimiento").

## Objetivo

Cliente del sistema de status (el mismo dominio que `svc-status`, consumido aquí como servicio
externo vía HTTP) para publicar el estado de salud de este monorepo (`svc-logs`) en el panel
compartido. Expone `LogsSpec`, la base común sobre la que cada servicio construye su propio
"spec" de monitorización (grupo de monitores + su estado), y `StatusConfig`, el tramo de
configuración que dice si el reporte de status está activo y a qué servidor apuntar.

**Un solo consumidor.** Solo `services/logs-web` lo importa (`SlaveSpec extends LogsSpec` en
`modules/data/status.ts`, y `StatusConfig`/`IStatusConfig` en `modules/utiles/config.ts`). Ni
`services/logs`, ni `services/logs-slave`, ni `services/workers-slave` lo usan — a pesar de que la
única implementación conocida de `LogsSpec` es `SlaveSpec`, y su `TGroup` se llama
`LOGS_SLAVE`, un nombre que por sí solo sugiere el servicio `logs-slave` y no `logs-web`. Ver la
nota sobre `TGroup.LOGS_SLAVE` más abajo. Con un único consumidor, la existencia de este paquete
como pieza *compartida* es hoy nominal: no hay nada que reutilizar todavía, aunque la clase base
(`LogsSpec`) está deliberadamente pensada para que otros servicios de este monorepo extiendan su
propio `Spec` sin duplicar `buildMonitors()`/`determineDiffTime()`.

## Árbol de módulos

```text
packages/status-base/
├─ modules/
│  ├─ status/
│  │  └─ status.ts       — LogsSpec<K> (abstract), TTimeUnit, TGroup
│  └─ utiles/
│     └─ config.ts       — StatusConfig/IStatusConfig, Configuracion/IConfiguracion (ver ojo abajo)
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json           — nombre de paquete real: "logs-status-base"
└─ tsconfig.json           — extiende services-comun-meteored/tsconfig.json
```

## Superficie pública

### `modules/status/status.ts` → `logs-status-base/modules/status/status`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `TTimeUnit` | `enum` | `MINUTE='m'`, `SECOND='s'`, `MILLISECOND='ms'` — unidad elegida por `determineDiffTime()`. |
| `TGroup` | `enum` | Un único valor: `LOGS_SLAVE = "logs_slave"`. Es el "grupo" (`name` de `Spec`) bajo el que se guarda/carga el spec en el servidor de status. Ver ojo abajo. |
| `LogsSpec<K>` | `abstract class extends Spec<K>` (`services-comun/modules/status/client/spec`) | Base común para publicar el estado de un servicio de este monorepo. `protected static readonly SERVICE = 16` — el id numérico de servicio registrado en el sistema de status externo (ver `services-comun/modules/status/client/client.ts`; no se ha podido confirmar en este repo a qué proyecto/etiqueta corresponde el `16` en el catálogo de `svc-status`, solo que es fijo para todo lo que extienda `LogsSpec`). El constructor es `protected`: solo se instancia desde una subclase. |
| `LogsSpec.buildMonitors()` | `public async` | Si `config.status.enabled`, crea un `Component` con nombre `"<pod.servicio> - <pod.zona>"`, delega en el abstracto `buildWorkspaceMonitors(component)` para que la subclase rellene sus monitores concretos, y guarda tanto el `Status` (componente) como el propio spec (`this.save()`, heredado de `Spec`). Si `enabled` es `false`, no hace nada — ni construye ni guarda. |
| `LogsSpec.determineDiffTime(ms)` | `protected` | Convierte una diferencia en milisegundos a la unidad más legible: minutos si `>60000`, segundos si `>1000`, milisegundos si no. Redondea a 2 decimales. Utilidad para que las subclases construyan mensajes de monitor ("hace X minutos"), aunque **`SlaveSpec` (el único consumidor conocido) no la usa** — construye su mensaje de otra forma (`updated: Date` directo en el monitor, sin pasar por esta conversión). |
| `LogsSpec.data` (getter, `override`) | `public` | Siempre devuelve `defaultSpec()` — es decir, **este getter no expone el estado cargado por `Spec.load()`**, solo el valor por defecto de la subclase. La subclase (`SlaveSpec`) resuelve esto sobreescribiendo `data` otra vez y llamando a `super.data` explícitamente para llegar al valor real cargado; quien no lo haga (una futura subclase que no repita ese patrón) leería siempre el spec vacío en vez del guardado. |
| `LogsSpec.cluster` (abstract getter) | — | Cada subclase decide qué forma tiene su `IClusterData` concreto. |

**Ojo con `TGroup.LOGS_SLAVE`**: el nombre del enum coincide con el del servicio `logs-slave` de
este mismo monorepo, pero **quien lo usa es `services/logs-web`** (`SlaveSpec`, en
`modules/data/status.ts` de ese servicio), no `services/logs-slave`. No se ha encontrado en este
repositorio ninguna explicación de por qué el grupo de status de `logs-web` se llama
`"logs_slave"` — puede ser un nombre heredado de una reorganización de servicios anterior. Cambiar
el valor del enum cambiaría el `name` con el que se guarda/carga el spec en el servidor de status
(rompiendo la continuidad con lo ya guardado), así que conviene no "corregirlo" sin más sin saber
si ese nombre es también el que espera el otro lado (el panel de `svc-status`).

### `modules/utiles/config.ts` → `logs-status-base/modules/utiles/config`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `IStatusConfig` | `interface extends IConfigGenerico` (`@mr/core-utils/config`) | `{enabled: boolean, server: string}`. |
| `StatusConfig` | `class extends ConfigGenerico<IStatusConfig>` | Aplica `user ?? defecto` sobre `enabled`/`server`. **Es el único símbolo de este fichero que consume el único consumidor conocido** (`services/logs-web/modules/utiles/config.ts`), junto con el tipo `IStatusConfig`. |
| `IConfiguracion` | `interface extends IConfiguracionBase` (`@mr/core-workload/config`) | `{status: IStatusConfig}`. |
| `Configuracion<T>` | `class extends ConfiguracionBase<T>` | Envuelve `StatusConfig` bajo la propiedad `status`. **No se ha encontrado ningún import de esta clase ni de `IConfiguracion` en ningún consumidor** — `services/logs-web` construye su propia clase `Configuracion` (en su propio `modules/utiles/config.ts`) extendiendo `services-comun-status/modules/config/service`, no esta. Parece código sin usar. |

**Duplicación con el framework compartido.** `StatusConfig`/`IStatusConfig` de este fichero son,
campo a campo, una redeclaración de `StatusConfig`/`IStatusConfig` que ya existen en
`services-comun/modules/status/utiles/config.ts` (framework compartido por todo el monorepo, no
solo `svc-logs`) — misma forma, misma lógica de *fallback* (`user.enabled??defecto.enabled` aquí,
`user.enabled!==undefined?user.enabled:defecto.enabled` en el framework: equivalentes). El único
consumidor de este paquete (`services/logs-web/modules/utiles/config.ts`) además **combina las
dos versiones**: usa `CONFIG_STATUS_DEFECTO` del framework (`services-comun/modules/status/utiles/config`,
que no existe en este paquete) como valor por defecto, pero envuelve ese valor con la clase
`StatusConfig` **de este paquete** (`logs-status-base`), no con la del framework. Funcionalmente
da el mismo resultado porque las dos clases son equivalentes, pero es una duplicación real: dos
clases con el mismo nombre y el mismo comportamiento, en dos paquetes distintos, usadas mezcladas
por el único consumidor. No se ha investigado si esto es deliberado (p.ej. para no atar este
paquete a una versión concreta del framework) o un descuido de una migración a medias.

## Dependencias

`devDependencies` declaradas en `package.json`:

- `@mr/core-utils` (workspace) — `Configuracion`/`IConfiguracion` genéricos, base de `StatusConfig`.
- `@mr/core-workload` (workspace) — `Configuracion`/`IConfiguracion` de red, base de la
  `Configuracion` de este paquete (la que no se usa, ver arriba); también, indirectamente, el
  `Client`/`Spec` de status que consume `LogsSpec` vienen de `services-comun`, no de aquí.
- `@types/node`
- `services-comun` (workspace) — no declarado explícitamente en el listado de `devDependencies`
  visto en `package.json`, pero `modules/status/status.ts` importa varios de sus módulos
  (`services-comun/modules/status/client/{component,spec,status,client}`) sin resolución de tipos
  propia — se resuelve por izado del monorepo (`services-comun` es dependencia transitiva de otros
  workspaces del proyecto). Cualquier cambio de esos módulos en `services-comun` afecta a este
  paquete sin que su `package.json` lo declare.
- `tslib`

## Consumidores directos

| Paquete | Ficheros consumidores | Uso |
|---------|------------------------|-----|
| `services/logs-web` | `modules/data/status.ts` (`SlaveSpec extends LogsSpec<ISpec>`), `modules/utiles/config.ts` (`StatusConfig`, `IStatusConfig`) | Único consumidor. `SlaveSpec` implementa `buildWorkspaceMonitors()` con un monitor fijo ("Elasticsearch") que refleja si la última tanda de publicación a Elasticsearch tuvo errores (`services/logs-web/modules/data/error.ts` alimenta ese estado cuando falla un `ingest`, ver el CODEMAP de `logs-services`). `SlaveSpec.get(config)` memoiza una única instancia por proceso (`_INSTANCE`), y solo llama a `load()` si `config.status.enabled`. |

`services/logs`, `services/logs-slave` y `services/workers-slave` no declaran ni importan
`logs-status-base`.

## Flujo de uso típico

```text
services/logs-web (tras un fallo de ingest de error, ver logs-services)
  SlaveSpec.get(config)                          — memoiza la instancia, la carga si status.enabled
    -> new SlaveSpec(TGroup.LOGS_SLAVE, config, client)   (logs-status-base: LogsSpec)
    -> spec.load(DEFAULT_SPEC())                          (Spec.load, services-comun)
  logsSpec.cluster.elastic.current_publish.{errors,count,date} = ...
  logsSpec.buildMonitors()
    -> new Component(...)                                (services-comun/modules/status/client/component)
    -> this.buildWorkspaceMonitors(component)             (SlaveSpec: monitor "Elasticsearch")
    -> status.save() + this.save()                        (HTTP hacia el servidor de status externo)
```

## Mantenimiento

1. Si se añade un segundo consumidor real, revisar si sigue teniendo sentido mantener
   `StatusConfig`/`IStatusConfig` duplicados frente a usar directamente los de
   `services-comun/modules/status/utiles/config` — hoy la duplicación solo tiene un punto de uso,
   así que es el momento más barato para unificarla si se decide hacerlo.
2. Si de verdad no hace falta la `Configuracion`/`IConfiguracion` de `modules/utiles/config.ts`
   (no se ha encontrado ningún consumidor), es candidato a retirarse — comprobar primero que
   ningún otro repositorio del organización (fuera de este monorepo) la importe por nombre de
   paquete antes de borrarla.
3. Antes de tocar el valor de `TGroup.LOGS_SLAVE` o el `SERVICE = 16` de `LogsSpec`, confirmar en
   el servidor de status externo que no hay specs ya guardados bajo ese `service`/`name` — cambiar
   cualquiera de los dos rompe la continuidad de lo ya publicado, no solo el nombre en el código.
4. Actualizar la tabla de "Superficie pública" y, si cambia el consumidor, la de "Consumidores
   directos" en este CODEMAP.
