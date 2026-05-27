# [Changelog](https://keepachangelog.com/en/1.1.0/) — `@mr/core-i18n`

---

## 0.0.0+1 — [@bixus](https://github.com/bixus)

### Added

- **`langs.ts` — tipos y utilidades de idiomas** — primer fichero del paquete.
  Exporta la definición canónica de todos los idiomas soportados por el sistema:

  - **`IdiomaCorto`** — unión de 40 códigos ISO 639-1 de dos letras
    (`"ar"`, `"bn"`, `"ca"`, … `"vi"`).
  - **`IdiomaLargo`** — unión de 24 variantes regionales BCP 47
    (`"es-ES"`, `"pt-BR"`, `"en-US"`, …).
  - **`Idioma`** — unión de `IdiomaCorto` e `IdiomaLargo`; tipo principal para
    cualquier código de idioma válido en el sistema.
  - **`soportados: Idioma[]`** — array con los 64 idiomas activos (40 cortos + 24 largos).
  - **`soportado(lang): boolean`** — comprueba si un código de idioma pertenece
    a la lista de soportados.
  - **`corto(idioma): IdiomaCorto`** — extrae el código corto ISO 639-1 de un
    idioma largo o corto (primeros dos caracteres).

- **`README.md`** — documentación del paquete con descripción de tipos, constantes
  y ejemplos de uso.

