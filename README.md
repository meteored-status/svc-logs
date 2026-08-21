# svc-logs

Servicios de gestión de logs.

Monorepo Yarn con la misma estructura que sus hermanos del grupo (`svc-status`): la
orquestación de desarrollo y compilación se centraliza en `mrpack`, y las
convenciones de código, ramas y versionado son las de
[`AGENTS.md`](./AGENTS.md), [`.github/copilot-instructions.md`](./.github/copilot-instructions.md)
y [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Mapa del repositorio

Cada workspace de negocio tiene su `CODEMAP.md` con el detalle técnico —módulos,
rutas, capa de datos y deuda conocida— y su `CHANGELOG.md`:

| Workspace | Qué es | Mapa |
|-----------|--------|------|
| `services/logs-web` | Ingesta HTTP de logs de servicio y de error: el único punto de escritura de esos dos flujos | [CODEMAP](./services/logs-web/CODEMAP.md) |
| `services/logs-slave` | Receptor por PubSub de notificaciones de GCS: accesos de Cloudflare hacia BigQuery | [CODEMAP](./services/logs-slave/CODEMAP.md) |
| `services/workers-slave` | Receptor equivalente para los logs de Cloudflare Workers | [CODEMAP](./services/workers-slave/CODEMAP.md) |
| `packages/logs-services` | Modelo del documento y resolución de índice/alias, para la ingesta | [CODEMAP](./packages/logs-services/CODEMAP.md) |
| `packages/status-base` | Base de monitorización (nombre npm: `logs-status-base`) | [CODEMAP](./packages/status-base/CODEMAP.md) |
| `packages/workers-base` | Base de ingesta de buckets de Workers | [CODEMAP](./packages/workers-base/CODEMAP.md) |

Los dos ejes del repositorio, para orientarse rápido:

- **Logs de servicio y de error** — `logs-web` los ingiere en Elasticsearch
  (`mr-log-servicios-*` y `mr-log-errores-*`, con un índice por proyecto y un alias
  fijo para leerlos juntos). Aquí ya **no se consultan**: las pantallas de logs del
  panel las sirve `status-backend`, en el repo `svc-status`, leyendo esos mismos
  alias — ver «El lado de lectura ya no está aquí» más abajo.
- **Accesos de Cloudflare** — `logs-slave` y `workers-slave` procesan
  notificaciones de GCS hacia BigQuery, con MySQL para el control de reintentos. No
  comparten datos con los dos anteriores, aunque las descripciones de sus
  `package.json` se parezcan (están copiadas).

### El lado de lectura ya no está aquí

Este repositorio tenía un segundo servicio, `services/logs`, que servía los listados de
logs del panel bajo `/private/logs/*`. Se retiró: esas consultas las hace ahora
`status-backend` (repo `svc-status`, rutas `/backend/log/{servicio,error}/…`) contra los
mismos alias, sin pasar por aquí.

El motivo no fue la organización del código, sino que aquellos endpoints eran internos y
**sin autenticación**: se creían el parámetro `projects` que les llegaba, así que el
filtro de «qué proyectos puede ver este usuario» acababa aplicándolo el BFF del panel. En
`status-backend` lo resuelve el propio backend con los departamentos del usuario, detrás
de su permiso.

Qué implica para este repositorio:

- La **forma del documento y los nombres de los alias** siguen siendo el contrato entre
  quien escribe (aquí) y quien lee (allí), y viven en el framework compartido
  (`services-comun-status/modules/services/logs/logs/elastic.ts`). Un cambio de campo o de
  nombre de índice rompe a los dos a la vez.
- Los **mappings y la política ILM** de esos índices siguen aquí (`mapping/logs/`): nada
  de eso se ha movido.
- El campo `checked` de los errores lo sigue poniendo a `false` la ingesta, pero quien lo
  pone a `true` —el «borrar» de la pantalla— es ahora `status-backend`.

## Scripts

Los del monorepo, definidos en el `package.json` de la raíz:

| Script | Qué hace |
|--------|----------|
| `yarn run devel` | Ejecuta los workspaces habilitados en `config.workspaces.json` |
| `yarn run packd` | Compila una vez los habilitados, sin watch |
| `yarn run packd-f` | Igual, pero **forzando también los deshabilitados**. Es el que hay que usar para comprobar que compila todo el repositorio |
| `yarn run update` | Actualiza el stack del monorepo |
| `yarn run patch:apply` | Aplica las migraciones automatizadas (se lanza solo tras `update`) |

## Mappings y DDL

`mapping/` es DDL **manual**: nada del código de este repositorio crea índices,
alias, plantillas ni políticas ILM. Contiene los mappings y settings de los índices
de Elasticsearch, los esquemas de las tablas de BigQuery de los accesos, el DDL
MySQL de las bases `logs` y `workers`, y los scripts de alta de notificaciones de
GCS.
