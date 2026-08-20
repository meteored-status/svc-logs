# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.8.19 — [Jose]

### Added
- **Los dos listados devuelven `total`, `reachable` e `histogram`**, para que el panel pueda pintar un
  paginador de verdad y una gráfica de distribución en vez del scroll infinito que tenía. Las tres cosas
  salen de la **misma** consulta que ya se hacía: el total con `track_total_hits`, y el reparto con un
  `auto_date_histogram` sobre `@timestamp`. Ninguna obliga a traer más documentos de los de la página.
- `ISearchResult` en `modules/data/log/{log-error,servicio}.ts`: lo que ahora devuelve cada `search()`.
  Antes devolvían el array de registros a secas.
- `CODEMAP.md` y este `CHANGELOG.md`. El workspace no tenía ninguno de los dos.

### Changed
- **`search()` recorta la paginación en vez de dejar que se salga de rango.** `perPage` se acota entre 1
  y `PER_PAGE_MAX` (200) y la página a la última alcanzable dentro de `MAX_RESULT_WINDOW`. El tamaño por
  defecto **no cambia**: sigue siendo 15, para no alterar la respuesta de quien no pide `perPage`.

### Notas de diseño
- **`reachable` va aparte de `total` a propósito.** Se pagina con `from`/`size`, así que no se puede
  pasar de la ventana de resultados de Elasticsearch (10.000): el paginador necesita saber hasta dónde
  puede llegar, y el rótulo necesita saber cuántos registros hay de verdad. Con un solo número, o se
  ofrecen páginas que el servicio no puede servir, o no se ve cuántos registros quedan fuera de alcance.
- `reachable` se calcula contra la última página **completa** y no contra los 10.000 pelados: con 30 por
  página la última acaba en el 9.990, y redondear al alza ofrecería una página que no existe.
- **El reparto de la gráfica se cuenta aquí y no en el navegador** porque los listados están paginados:
  en el cliente solo hay los registros de una página, y repartirlos en tramos dibujaría el reparto de 50
  registros como si fuera el del filtro entero. De paso, una agregación cuenta sobre todo lo que casa,
  así que `histogram` es lo único de la respuesta que **no** está limitado por la ventana de resultados.
- La anchura de tramo la elige Elasticsearch (`auto_date_histogram`, techo de 32 tramos) y viaja en
  `interval`: el rango depende de lo que filtre quien pregunta, así que una anchura fija daría tramos
  absurdos en los extremos.
- **En los errores, las tres cifras son de los no revisados**, no de todos. Es coherente con el listado
  —que siempre lleva `{term: {checked: false}}` cableado— pero conviene tenerlo claro al leer un total:
  es «pendientes», no «históricos».
- **Lo que queda cojo a propósito**: el recorte de página no se comunica. `IListOUT` no devuelve
  `page`/`perPage` normalizados, como sí hace el listado de auditoría de `status-backend`, así que quien
  pida una página fuera de alcance recibe la última sin saber que le han cambiado la página. Desde el
  panel no ocurre —su paginador cuenta con `reachable`—, y cerrarlo del todo obliga a ampliar otra vez el
  contrato, así que se deja anotado.
- `PER_PAGE_MAX`, `MAX_RESULT_WINDOW` e `IHistogram` se declararon en el contrato compartido
  (`services-comun-status/.../logs/logs/interface.ts`, junto a `ESeverity`) porque los usan los dos
  listados y el consumidor. Al ser un paquete de framework, ese cambio hay que enviarlo con
  `yarn mrpack framework --send`.
