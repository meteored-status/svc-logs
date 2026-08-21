# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

## 2026.8.21 — [Jose]

### Changed
- Pasa a tener **un solo consumidor**, `services/logs-web` (la ingesta): se ha retirado
  `services/logs`, que era el de lectura, y esas consultas las hace ahora `status-backend` en el repo
  `svc-status`, con su propia copia del contrato en el framework compartido
  (`services-comun-status/modules/services/logs/logs/elastic.ts`) en vez de importar este paquete.

  Los `getAlias()` de aquí siguen describiendo lo que ese otro servicio lee, así que el paquete no ha
  perdido responsabilidad: lo que ha perdido es al lector que compilaba con él. Ahora son dos
  declaraciones del mismo documento en dos repositorios, y si una cambia sin la otra la ingesta y la
  consulta dejan de entenderse sin que nada falle al compilar. Lo suyo, el día que se toque, es que
  este paquete importe del framework en lugar de repetirlo.

## 2026.8.19 — [Jose]

### Added
- `CODEMAP.md` — primer mapa técnico del workspace: documenta `Log` y `Error`
  (`modules/data/{servicio,error}.ts`), la asimetría entre el índice de escritura por proyecto
  (`getIndex()`) y el alias fijo de lectura (`getAlias()`), y los dos consumidores directos
  (`services/logs`, `services/logs-web`).
