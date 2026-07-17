# AGENTS.md

> **Nota sobre este archivo:** la copia canónica vive en `@mr/core/dev/AGENTS.md` y en la raíz del proyecto se expone mediante el enlace simbólico `AGENTS.md`.

## Contexto rapido del monorepo
- `web-www` es un monorepo Yarn 4 (`packageManager: yarn@4.16.0`) con workspaces en `@mr/*`, `framework/*`, `packages/*`, `services/*`, `jobs/*`, `cronjobs/*`.
- La orquestacion de desarrollo/build no se hace con scripts ad-hoc por servicio: se centraliza en `mrpack` (`@mr/cli/bin/mrpack.js`).
- Capas principales: `@mr/core/*` (infra compartida), `framework/services-comun` (runtime legacy comun), `services/*` (apps desplegables), `packages/*` (librerias funcionales).

## Arquitectura y limites entre componentes
- Los servicios Node arrancan con el patron `Main.ejecutar(Engine, Configuracion)` (ejemplo: `services/www-frontend/main.ts`, `services/www-estaticos/main.ts`).
- El ciclo de vida real (carga config, sidecar Istio, master/worker, shutdown cronjob) vive en `framework/services-comun/main.ts`.
- HTTP/WebSocket compartido vive en `@mr/core/network`:
  - HTTP: router declarativo por `Routes` + `RouteGroup` (`@mr/core/network/server/http/README.md`).
  - WebSocket: `createWSServer()` singleton + `IWSHandler` tipado + streaming (`@mr/core/network/server/websocket/README.md`).
- Integracion entre ambos: si un `RouteGroup` devuelve handlers WS en `getWSHandlers()`, el servidor WebSocket se inicia/expande automaticamente.

## Flujos de trabajo criticos
- Desarrollo (ejecutar habilitados en `config.workspaces.json`): `yarn run devel`
- Compilar TODOS los workspaces habilitados (una sola vez, sin watch; termina al acabar): `yarn run packd`
  (equivale a `yarn mrpack devel -c`). Solo compila los marcados como habilitados en
  `config.workspaces.json` (propiedad `packd.available`/`packd.disabled`).
- **Un agente de IA que necesite compilar todo el proyecto debe usar SIEMPRE `-f`/`--forzar`
  además de `-c`**: `yarn mrpack devel -c -f` (equivale a `yarn run packd-f`). Así se compilan
  también los workspaces deshabilitados en `config.workspaces.json`, sin que el resultado
  dependa de esa configuración local/por-desarrollador. `yarn run packd` (sin `-f`) puede dar
  una compilación incompleta si algún workspace está deshabilitado.
- Compilar SOLO un workspace concreto (una sola vez, sin watch): `yarn run <workspace> run packd`.
- Ejecutar/depurar SOLO un workspace concreto (requiere que ya tenga `output/` compilado):
  `yarn run <workspace> run devel` (`run dev` en vez de `run devel` si su framework es Next.js).
  Ojo: esto **ejecuta**, no compila — para compilar ese workspace usa `run packd` (ver arriba).
- Forzar todos los workspaces también en modo ejecución (incluye deshabilitados): `yarn run devel-f`
- Actualizacion de stack del monorepo: `yarn run update`
- Tras update, aplicar migraciones automatizadas SIEMPRE: `yarn run patch:apply`.
- Ejecutar scripts de un workspace desde raiz: `yarn run www-frontend <script>` (atajo de `yarn workspace www-frontend <script>`).
- No hay script raiz `test` descubierto; para validar cambios, usa compilacion/watch del workspace afectado y comandos `mrpack`.

## Convenciones no obvias (importantes para agentes)
- Fuente canonica de convenciones AI: `.github/copilot-instructions.md` (ojo: `.github/` es symlink a `@mr/core/dev/.github/` y `AGENTS.md` en raíz es symlink a `@mr/core/dev/AGENTS.md`).
- Claude Code no lee `AGENTS.md` ni `.github/copilot-instructions.md` automaticamente: `CLAUDE.md` en raíz (symlink a `@mr/core/dev/CLAUDE.md`) importa explícitamente ambos (`@AGENTS.md` y `@.github/copilot-instructions.md`) para que reciba las mismas instrucciones sin duplicar contenido. Ojo: una mención a un fichero entre backticks (como la de la línea de arriba) es solo texto — no es un import; el import real requiere la sintaxis `@ruta` sin backticks.
- Mantener `CODEMAP.md` en la misma tarea cuando haya cambios significativos (modulos, API publica, rutas, flujos o reorganizacion). Si no existe, crearlo y enlazarlo desde el `README.md` mas cercano.
- Esta regla se hace cumplir tambien mediante un hook `Stop` de Claude Code
  (`.claude/hooks/check-codemap.mjs`, declarado en `.claude/settings.json`). Todo `.claude/` es
  symlink a `@mr/core/dev/.claude/` (igual que `.github/`), expuesto por `initClaudeDir()` en
  `@mr/cli/src/mrpack/clases/init/symlinks.ts`; `.claude/settings.local.json` (local) queda
  excluido tanto del envio del framework (`@mr/core/dev/.claude/.mr-ignore`) como del `.gitignore`
  raiz de cada monorepo consumidor (`**/.claude/settings.local.json` en la plantilla `IGNORE` de
  `@mr/cli/src/mrpack/clases/init/ignore.ts`), asi que nunca se versiona ni se propaga. Al
  terminar un turno con cambios sin comitear,
  agrupa los ficheros de codigo modificados por workspace (directorio con `package.json` mas
  cercano, excluyendo la raiz del monorepo) y bloquea una vez si algun workspace con cambios
  significativos (fichero nuevo, o >=15 lineas modificadas) no toco su `CODEMAP.md`, o su
  `CHANGELOG.md` si ya existia. Solo analiza working tree (no commits), y por el guardrail
  `stop_hook_active` de Claude Code el bloqueo ocurre como maximo una vez por intento de parada
  (evita bucles infinitos). Ver `@mr/core/dev/README.md` y `@mr/core/dev/.claude/CODEMAP.md`
  para el detalle de la heuristica.
- TypeScript estricto; evitar `any` explicito salvo necesidad real.
- Imports en 3 bloques con una linea en blanco: (1) node/publico, (2) otros workspaces, (3) local relativo; usar `type` en imports solo-tipo.
- Entre workspaces usa imports por nombre de paquete (`@mr/core-network/...`, `services-comun/...`), no rutas relativas cruzadas.
- Logging: usar `info`/`error` de `services-comun/modules/utiles/log`; evitar `console.log`.
- Promesas diferidas: usar `Deferred<T>` de `services-comun/modules/utiles/promise`.
- Propiedades de instancia se inicializan en constructor (no en declaracion), `if/else/for/while` siempre con llaves, y sin dobles lineas en blanco en `.ts/.js`.

## Integraciones externas y operacion
- Datadog esta integrado desde bootstrap (`services/*/app.js`) y en WebSocket se propaga traza cliente-servidor via `_datadog`.
- TLS/SNI HTTP espera certificados en `files/ssl/<dominio>/` + fallback en `files/ssl/` (ver `@mr/core/network/server/http/README.md`).
- `framework/services-comun/main.ts` comprueba sidecar en `http://localhost:15020/healthz/ready` y usa `/quitquitquit` al cerrar cronjobs.
- `mrpack framework` opera paquetes compartidos contra GCS (updates/reset/send) y guarda logs en `tmp/log/*.pull.md`.

## Archivos que un agente debe leer primero
- `README.md` (scripts raiz y flujo update+patch)
- `.github/copilot-instructions.md` (reglas de estilo obligatorias)
- `@mr/cli/README.md` (modulos `mrpack`, especialmente `devel`, `update`, `framework`)
- `@mr/core/dev/README.md` (tsconfig base, manifest, patches)
- `@mr/core/network/server/http/README.md` y `@mr/core/network/server/websocket/README.md` (patrones de red y contrato runtime)
