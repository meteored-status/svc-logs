# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.8.19 — [Jose]

### Added
- `CODEMAP.md` — primer mapa técnico del workspace: documenta `Log` y `Error`
  (`modules/data/{servicio,error}.ts`), la asimetría entre el índice de escritura por proyecto
  (`getIndex()`) y el alias fijo de lectura (`getAlias()`), y los dos consumidores directos
  (`services/logs`, `services/logs-web`).
