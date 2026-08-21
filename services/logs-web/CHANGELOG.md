# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas arriba.

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
