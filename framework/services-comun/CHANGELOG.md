# [Changelog](https://keepachangelog.com/en/1.1.0/)

---
## 2024.10.7 R1
### Changed
- [Jose] Se ha desactivado los warnings de NodeJS en producción para los `DeprecationWarning`

### Updated
- [Jose] Update de librerías:
  - [@sequelize/core](https://www.npmjs.com/package/@sequelize/core) 7.0.0-alpha.43

---
## 2024.10.3 R1
### Added
- [Jose] Añadido soporte a indicar el idioma por defecto de las traducciones
  - Anteriormente, el idioma por defecto era `en`
  - Esto se indica en el `package.json` del proyecto `i18n`
  ```
  {
    ...
    "config": {
      "lang": "en-US",
      "langs": [
          "de-DE",
          "de-AT",
          "en-US",
          "en-GB",
          ...
      ],
      ...
    }
  }
  ```

---
## 2024.10.2 R2

### Added
- [Jose] En los maps de traducciones, ahora se heredan las traducciones de las keys según jerarquía

### Fixed
- [Jose] Corregido error en la generación de traducciones de submódulos con idiomas heredados, no los generaba correctamente
- [Jose] Corregido el soporte a idiomas heredados, no cogía el idioma correctamente

### Changed
- [Jose] Ahora se generan todavía menos chunks de traducción en determinadas circunstancias
- [Jose] Se ha acelerado **ENÓRMEMENTE** la generación de traducciones
- [Jose] Se ha cambiado a mayúsculas este archivo para localizarlo fácilmente

---
## 2024.10.2 R1

### Changed
- [Jose] Se ha cambiado el framework de traducciones:
  - Ahora se generan menos chunks al compartirse traducciones heredadas
  - Se ha optimizado el código generado
