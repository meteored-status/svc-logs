# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

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
