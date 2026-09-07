# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.9.7 17:21 — [Jose]

### Changed
- **`logs-services` y `logs-status-base` se integran aquí y desaparecen.** Los dos existían para
  compartir y este servicio era su único consumidor: cuatro importaciones en total. Ahora cada cosa está en
  el fichero que ya era su único sitio —el documento y el índice en `data/{servicio,error}.ts`, el spec de
  status en `data/status.ts`, `StatusConfig` en `utiles/config.ts`— y `packages/` se queda con
  `workers-base`.
- **El documento indexado sale del framework compartido** (`services-comun-status/modules/services/logs/logs/elastic`),
  que es de donde lo lee el panel. `logs-services` declaraba las mismas propiedades y el mismo
  `"mr-log-errores"` por su cuenta: dos declaraciones del mismo documento en dos repos que compilan por
  separado, que es justo lo que el CODEMAP ya avisaba de que había que unificar «el día que se toque».
- Con las clases de documento se van sus getters —envolvían una interfaz para acabar en un `toJSON()`— y un
  segundo `BulkAuto` que arrancaba dentro de `Log` y al que nadie escribía: un temporizador vaciando una cola
  siempre vacía.
- De `LogsSpec`, que era abstracta con una sola implementación, se quedan fuera `determineDiffTime()` y
  `TTimeUnit`: sin usar, y copia de lo que ya hay en `services-comun/modules/utiles/fecha.ts`.
- `logs-web` declara `@mr/core-utils`, que antes le llegaba de rebote por `logs-status-base`.

### Notas
- **Encontrado al fusionar, y no arreglado a propósito:** el monitor de Elasticsearch no puede ponerse en
  rojo. `data` devuelve un `DEFAULT_SPEC()` nuevo en cada llamada, así que las tres escrituras del `catch` de
  `ingestError` caen en tres objetos distintos y `buildMonitors()` lee un cuarto, vacío. Está documentado en
  el CODEMAP y avisado en el propio código. Arreglarlo enciende un monitor que lleva verde desde que existe,
  y eso se decide aparte.

## 2026.8.21 — [Jose]

### Changed
- Este servicio se queda **solo** con el flujo de logs de servicio y de error: se ha retirado
  `services/logs`, el que servía los listados del panel bajo `/private/logs/*`, y esas consultas las
  hace ahora `status-backend` (repo `svc-status`) contra los mismos alias.

  Aquí no cambia nada de código, pero sí lo que hay que tener en cuenta al tocarlo: el consumidor de lo
  que se indexa está en **otro repositorio**, así que un cambio de forma de documento o de nombre de
  alias rompe la consulta sin que nada falle al compilar. El contrato compartido vive en el framework
  (`services-comun-status/modules/services/logs/logs/elastic.ts`); `logs-services` lo declara aparte
  por su cuenta y las dos declaraciones tienen que decir lo mismo.
- `CODEMAP.md`: la sección «Relación con `services/logs`» pasa a «Quién lee lo que se escribe aquí»,
  con el repositorio y las clases que hoy consultan estos índices.

## 2026.8.19 — [Jose]

### Added
- `CODEMAP.md`: mapa técnico del workspace.
