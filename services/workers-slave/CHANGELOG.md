# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.11.18 13:28 — [Jose]

### Fixed
- **Los eventos `alarm` de Cloudflare ya no fallan al parsear.** Son las alarmas de los Durable
  Objects (`widget-rate-limiter` y `api-rate-limiter-prod`, entrypoint `RateLimiter`). Traen
  `Event: {ScheduledTimeMs}` y no traen RayID, Request ni Response, así que el esquema las rechazaba
  todas. Eran más de 5.000 `ERROR` al día desde al menos el 2026-10-19, y esos eventos no se
  indexaban. Ahora se indexan en `logs-worker-*` con `event.type: "alarm"` y `event.scheduledTime`.
- **`Outcome: "unknown"` ya no se rechaza.** Venía en peticiones `fetch` de `meteored-web-*` y de
  los rate limiters: unas 470 en 30 días.

### Changed
- `event.type` admite los `EventType` que documenta Cloudflare para Workers Trace Events (`fetch`,
  `alarm`, `scheduled`, `queue`, `email`, `worker_rpc`, `hibernatable_web_socket`), además de
  `tail`, que ya se aceptaba. Cloudflare no documenta la forma de `Event` en los tipos que no se han
  visto en producción, así que se guarda como texto JSON en `event.detail`. `event.rayID`,
  `event.request` y `event.response` pasan a ser opcionales: solo los trae `fetch`.
- `status` admite los 8 valores de `Outcome` documentados: los 4 de Logpush y los 4 que añade la
  Tail API.
- **Las líneas que no se pueden parsear ya no escriben un `ERROR` cada una.** Se agrupan por motivo
  corto (p. ej. `EventType="nuevo"` o `Event: claves no reconocidas X`) y se escribe un solo
  `error()` por fichero, con el número de líneas y un ejemplo recortado de cada motivo.
- El esquema Zod pasa a `modules/data/source/cloudflare-schema.ts` (`parsearLinea()`), que solo
  depende de `zod`. Así se prueba sin Elasticsearch, GCS ni MySQL.

### Added
- Pruebas `node:test` en `spec/cloudflare-schema.spec.ts`, con eventos reales de producción.
  Se lanzan con `yarn run workers-slave test`, que usa `tsconfig.spec.json`. `typescript` se añade a
  `devDependencies` para el script `test`.

## 2026.9.8 08:45 — [Jose]

### Changed
- **`packages/workers-base` se fusiona en este workspace y desaparece.** Era un paquete con un
  único consumidor —este—, así que la separación no compartía nada: solo obligaba a leer dos
  workspaces y a encadenar `Bucket extends BucketBase` para lo que ahora es una sola clase.
  - `modules/data/bucket.ts` — la clase base y la derivada se funden en un único `Bucket`.
    `findBucket`/`findBucketEjecutar` y el constructor pasan de `protected` a `private`, que es lo
    que son ahora que nadie hereda. `run()` usa `bucket.getCliente()` en vez de reconstruir el
    `ICliente` a mano con el mismo valor.
  - `modules/data/source/cloudflare.ts` — movido tal cual desde el paquete.
  - `modules/utiles/config.ts` — la constante `GOOGLE` se declara aquí, junto a su único uso.
- `INotify` (`{bucketId, objectId}`) se declara y exporta una sola vez desde `modules/data/bucket.ts`.
  Estaba redeclarada, idéntica y sin exportar, en tres ficheros distintos.
- `zod` pasa a ser dependencia de este workspace (la usa `Cloudflare.SCHEMA*`), con el mismo rango
  que ya declaraba `workers-base`.

### Fixed
- El `catch` de `Cloudflare.guardar()` usa `error()` en vez de `console.log()`, como el resto del
  fichero y como manda la convención del monorepo.

## 2026.8.19 — [Jose]

### Added
- `CODEMAP.md` (este workspace no tenía documentación técnica previa).
