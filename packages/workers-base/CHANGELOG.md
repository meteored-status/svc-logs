# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.8.19 — [Jose]

### Added
- `CODEMAP.md` — primer mapa técnico del workspace: documenta `Bucket`/`Cloudflare` de
  `modules/data/{bucket,source/cloudflare}.ts`, la discrepancia entre el índice de deduplicación
  (`workers-accesos-<cliente>`) y el índice de escritura (`logs-worker-<cliente>`), y su único
  consumidor conocido (`services/workers-slave`).
