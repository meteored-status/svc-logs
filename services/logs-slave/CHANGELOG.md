# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.9.3 — [Jose]

### Fixed
- Una línea corrupta ya no tira el fichero entero: `procesarLinea()` se envuelve por línea, la
  descarta y sigue (antes, un `SCHEMA.parse` fallido abortaba el bucle y se perdían también todas
  las líneas ya acumuladas del mismo fichero).
- El volcado a BigQuery se espera antes de borrar el objeto de GCS. Antes `guardar()` se lanzaba
  sin `await` y `ClienteGCS.ingest()` borraba el fichero de inmediato, así que un fallo de
  inserción — o el corte de CPU de Cloud Run al responder — se llevaba los datos por delante.
  El despliegue no activa `run.googleapis.com/cpu-throttling: "false"`, así que al enviar la
  respuesta la CPU queda estrangulada y el trabajo en segundo plano no tenía garantía de
  completarse. Para que esperar el volcado no alargue la request, los bloques se insertan con
  concurrencia acotada (8) en vez de en serie; con el ack deadline de la suscripción push en 180 s
  hay margen de sobra.
- Si alguna inserción en BigQuery falla, el objeto **no** se borra del bucket y queda disponible
  para repesca (`mapping/repesca-errores.sh`).
- `resourceName` se valida contra su prefijo literal en vez de recortarlo con un `substring(19)`
  cableado, que ante un cambio de formato habría devuelto un nombre de bucket cortado por el sitio
  equivocado sin señalarlo.
- `ClienteGCS.getArchivo()` usa el logger del monorepo (`info`/`error`) en vez de `console.log`.
- El nombre "humanizado" de los crawlers ya no arrastra restos de sintaxis de expresión regular:
  las sustituciones de escapes son globales y las clases de un carácter (`[sS]`) se resuelven de
  forma genérica. **Afecta al valor de `cliente.crawler` en BigQuery**: cambian 11 de los ~1500
  patrones de `crawler-user-agents` (p.ej. `" [cc]rawler"` → `" crawler"`).

### Added
- Arnés de pruebas (`node:test` + `tsconfig.spec.json`, `yarn run logs-slave test`) y 43 pruebas
  sobre la lógica pura: parseo del `resourceName`, esquema Zod de Cloudflare, `Registro` y sus tres
  serializaciones, `Crawler` y el parser de líneas.
- `modules/data/source/parser.ts`: la construcción de filas se separa del volcado a BigQuery.
- `modules/net/resource.ts`: parseo del `resourceName` de la notificación.

### Changed
- `trocear()` ya no necesita comprobar el array vacío: se corrigió `arrayChop()` en `services-comun`
  para que un array vacío no produzca ningún bloque (antes devolvía `[[]]`, un bloque vacío que
  habría acabado en un `insert` de 0 filas a BigQuery).
- El catálogo `ClienteGCS.BUCKETS` se compacta (los 25 subproyectos de `tiempo` se derivan de una
  lista) — mismas 31 entradas, sin repetir `bucket`/`tipo` en cada una.
- `Registro` deja de duplicar cada pieza en `data` y `obj`; `IRegistroRespuestaES`, que era un
  duplicado exacto de `IRegistroRespuesta`, desaparece.
- `Grupo` deja de arrastrar una referencia al `Cliente` que nadie leía.
- El cliente de BigQuery se crea bajo demanda, no al cargar el módulo.
- El caché de user-agents de `Crawler` pasa a estar acotado (10 000 entradas, FIFO).

## 2026.8.19 — [Jose]

### Added
- `CODEMAP.md` (este workspace no tenía documentación técnica previa).
