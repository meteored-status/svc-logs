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
| `services/logs-slave` | Receptor por PubSub de notificaciones de GCS: accesos de Cloudflare hacia BigQuery | [CODEMAP](./services/logs-slave/CODEMAP.md) |
| `services/workers-slave` | Receptor equivalente para los logs de Cloudflare Workers | [CODEMAP](./services/workers-slave/CODEMAP.md) |

Hoy queda **un solo eje**: los accesos de Cloudflare. `logs-slave` (tráfico HTTP de borde,
Logpush → BigQuery) y `workers-slave` (*tail events* de Workers → Elasticsearch) reciben
notificaciones de GCS y procesan el objeto que las dispara. Comparten la forma, no el código
ni los datos, y las descripciones de sus `package.json` se parecen porque están copiadas.

### Los logs de servicio y de error ya no están aquí

Este repositorio nació con ese segundo eje —los logs de servicio y de error del panel— y ya
no conserva ninguna de las dos mitades:

- **La lectura** se fue primero. `services/logs` servía los listados bajo `/private/logs/*`;
  esas consultas las hace ahora `status-backend` (repo `svc-status`, rutas
  `/backend/log/{servicio,error}/…`). El motivo no fue la organización del código, sino que
  aquellos endpoints eran internos y **sin autenticación**: se creían el parámetro `projects`
  que les llegaba, así que el filtro de «qué proyectos puede ver este usuario» acababa
  aplicándolo el BFF del panel. En `status-backend` lo resuelve el propio backend con los
  departamentos del usuario, detrás de su permiso.
- **La escritura** se fue después (2026-09-07). `services/logs-web` ingería por HTTP en
  `mr-log-servicios-*` y `mr-log-errores-*`; esa ingesta la hace ahora `status-external`, en
  ese mismo repo. La URL pública no cambió —el prefijo `/service/logs/` se movió de un
  `VirtualService` al otro—, y el workspace se retiró de aquí una vez verificado.

Con las dos mitades fuera, los mappings de esos índices (`mapping/logs/log-servicios-*` y
`log-errores-*`) se retiran también; lo que sigue en `mapping/logs/` pertenece a otros índices.

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
