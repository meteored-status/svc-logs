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
| `services/logs` | **Lado lectura**: consulta de logs de servicio y de error, bajo `/private/logs/*`. Lo consume el panel de Status | [CODEMAP](./services/logs/CODEMAP.md) |
| `services/logs-web` | **Lado escritura**: ingesta HTTP de logs de servicio y de error. Escribe los índices que lee `services/logs` | [CODEMAP](./services/logs-web/CODEMAP.md) |
| `services/logs-slave` | Receptor por PubSub de notificaciones de GCS: accesos de Cloudflare hacia BigQuery | [CODEMAP](./services/logs-slave/CODEMAP.md) |
| `services/workers-slave` | Receptor equivalente para los logs de Cloudflare Workers | [CODEMAP](./services/workers-slave/CODEMAP.md) |
| `packages/logs-services` | Modelo del documento y resolución de índice/alias. Es lo que comparten `logs` y `logs-web` | [CODEMAP](./packages/logs-services/CODEMAP.md) |
| `packages/status-base` | Base de monitorización (nombre npm: `logs-status-base`) | [CODEMAP](./packages/status-base/CODEMAP.md) |
| `packages/workers-base` | Base de ingesta de buckets de Workers | [CODEMAP](./packages/workers-base/CODEMAP.md) |

Los dos ejes del repositorio, para orientarse rápido:

- **Logs de servicio y de error** — `logs-web` los ingiere y `logs` los sirve, sobre
  los mismos índices de Elasticsearch (`mr-log-servicios-*` y `mr-log-errores-*`,
  con un índice por proyecto y un alias fijo para leerlos juntos). Los une
  `packages/logs-services`, así que **un cambio de forma del documento o de nombre
  de índice ahí afecta a los dos servicios a la vez**.
- **Accesos de Cloudflare** — `logs-slave` y `workers-slave` procesan
  notificaciones de GCS hacia BigQuery, con MySQL para el control de reintentos. No
  comparten datos con los dos anteriores, aunque las descripciones de sus
  `package.json` se parezcan (están copiadas).

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
