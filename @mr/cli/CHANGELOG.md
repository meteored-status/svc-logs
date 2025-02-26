# [Changelog](https://keepachangelog.com/en/1.1.0/)
---
## 2025.2.24+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) 7.15.2
    - [sass](https://www.npmjs.com/package/sass) 1.85.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.5
    - [webpack](https://www.npmjs.com/package/webpack) 5.98.0


---
## 2025.2.4+1

### Added
- [Jose] Se ha añadido manifiesto raiz de proyecto, orientado a configurar la construcción y despliegue del proyecto para producción/test de cara a la herramienta ci/cd

### Changed
- [Jose] Se ha limpiado las variables del proceso de despliegue
- [Jose] Se ha eliminado la necesidad de (des)autorizar antes de desplegar

---
## 2025.1.31+1

### Changed
- [Jose] Refactorizado el directorio `@mr/cli/manifest` a `@mr/cli/manifest/workspace` para dejar espacio a otros tipos de manifest
  - Se mantiene el la importación desde `@mr/cli/manifest` ya que solo será interesante exportar el manifiesto de workspaces

---
## 2025.1.30+1

### Changed
- [Jose] Se ha cambiado la estructura de la configuración de los workspaces, ahora en lugar de definirse dentro del archivo package.json se definen dentro del archivo mrpack.json ubicado en la raiz de cada workspace
  - Se puede obtener la referencia de la estructura de los archivos `mrpack.json` en [manifest/workspace/index.md](manifest/workspace/index.md)

---
## 2025.1.24+1

### Changed
- [Jose] Añadida estructura de nuevo archivo de manifiesto para los workspaces
- [Jose] Se ha cambiado las dependencias de mrpack para hacer la antigua interfaz Legacy
- [Jose] Se exporta la interfaz y clases para el nuevo manifiesto para poder leer el manifiesto desde los workspaces

---
## 2025.1.20+1

### Changed
- [Jose] Se ha separado los workspaces de `servicios` de los workspaces de `cronjobs`, ahora cada uno puede estar en su respectivo directorio
  - Por el momento pueden convivir mezclados tanto en el directorio `services` como en el directorio `cronjobs`

### Breaking Changes
- [Jose] El argumento pasado al Dockerfile `ws` se ha cambiado a `WS` (en mayúsculas). Si se ha creado un custom Dockerfile entonces hay que modificarlo en consecuencia

---
## 2025.1.16+5

### Updated
- [Juan Carlos] Update de librerías:
  - [chokidar](https://www.npmjs.com/package/chokidar) 4.0.3

---
## 2025.1.9+1

### Updated
- [Jose] Update de librerías:
    - [@google-cloud/storag](https://www.npmjs.com/package/@google-cloud/storag) 7.15.0
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.2.1
    - [webpack-cli](https://www.npmjs.com/package/webpack-cli) 6.0.1
---
## 2024.12.16+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.2
    - [sass](https://www.npmjs.com/package/sass) 1.83.0

---
## 2024.12.10+1

### Updated
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.2.0
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.1

---
## 2024.12.4+1

### Changed
- [Jose] El archivo tsconfig.json ya no depende de services-comun
- [Jose] Añadida librería:
    - [@tsconfig/node22](https://www.npmjs.com/package/@tsconfig/node22) 22.0.0
- [Jose] Los binarios del `cli` ahora también se comparten cuando se sube una nueva versión
- [Jose] Se ha añadido la posibilidad de marcar ficheros/directorios como binarios para que no se mezclen sino que se sustituyan

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.82.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.4

---
## 2024.12.3+1

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.81.1
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.0

---
## 2024.11.28+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.1

---
## 2024.11.26+3

### Changed
- [Jose] Ahora se autoselecciona la versión LTS de node al abrir la consola

---
## 2024.11.26+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.0

---
## 2024.11.25+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.9.3
    - [typescript](https://www.npmjs.com/package/sass) 5.7.2

---
## 2024.11.18+1

### Changed
- [Jose] Se ha modificado los scripts internos del Cli
  - El script de actualización ya no da error

---
## 2024.11.15+1

### Changed
- [Jose] Revisado el loader de las herramientas para que detecte errores en el ejecutable y fuerce la recompilación

### Fixed
- [Jose] Fijada la librería [@elastic/elasticsearch](https://www.npmjs.com/package/@elastic/elasticsearch) a la versión `8.15.2` dado que la versión nueva `8.16.0` da errores de tipado

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.81.0

---
## 2024.11.14+1

### Changed
- [Jose] Correcciones visuales

---
## 2024.11.13+27

### Changed
- [Jose] Mejoras visuales del Cli

---
## 2024.11.13+26

### Fixed
- [Jose] Se han corregido muchos errores a la hora de actualizar el packaje.json del propio Cli

---
## 2024.11.13+1

### Updated
- [Jose] Update de librerías:
  - [sass](https://www.npmjs.com/package/sass) 1.80.7

---
## 2024.11.12+6

### Added
- [Jose] Añadida opción para listar frameworks
  ```bash
    yarn mrpack framework --list=<client|core|legacy> [--repository={bucket}]
  ```

---
## 2024.11.12+1

### Fixed
- [Jose] Ya se puede resetear el Cli
  - Cuando se resetea el Cli se comprueba si la versión compilada se corresponde con el código fuente actual y se reinicia el reseteo en caso de tener una versión nueva, así se hará el reseteo con una versión compilada actualizada
- [Jose] Cuando se actualiza el Cli, solo se reinicia el proceso si la nueva versión compilada ha cambiado respecto a la versión compilada anterior
- [Jose] Ya se envían, actualizan y resetean todos los FW con el código nuevo

---
## 2024.11.11+6

### Fixed
- [Jose] Corregida la detección de versión anterior para incrementar la versión

---
## 2024.11.11+5

### Fixed
- [Jose] Ahora se comprueba que el cli está compilado con el código actual evitando que el código se quede anticuado al actualizar el código por el commit de otra persona en git
- [Jose] Se ha añadido soporte varios formatos de frameworks (root, core, client y legacy)

---
## 2024.11.11+4

### Fixed
- [Juan Carlos] Corregido error al generar traducciones. Cuando no existía el idioma, en lugar de coger las traducciones del padre, se estaban cogiendo las "defecto".

---
## 2024.11.11+1

### Added
- [Jose] Se ha implementado la corrección de errores de GIT relacionados con cambios entre mayúsculas y minúsculas

---
## 2024.11.7+1

### Changed
- [Jose] Se ha reimplementado el PULL y PUSH del Cli:
  - Ahora se puede indicar el bucket al que sincronizar
  - Ahora en el bucket se almacenan copias versionadas en formato zip
  - Ahora al hacer un PULL se descarga la última versión del bucket además de la versión actual sin modificar para verificar los cambios a la hora de hacer el merge
  - Ahora se puede hacer PUSH y PULL en Windows (Beta), de momento solo para el caso del Cli
  - Ya no se utiliza el comando gsutil para interactuar con el almacén de Google Cloud
  - De momento se mantiene el PUSH antiguo para el cli, para que los proyectos puedan actualizarse al nuevo Cli
  - Se ha desactivado la opción de Reset para el caso del Cli
  - Se ha desactivado las opciones de Add y Remove para añadir y eliminar frameworks
  - Las releases ahora incluyen el nombre de git de quien la sube
  - Eliminada la necesidad de mantener en el repositorio el archivo status.json
  - Cuando se compila el proyecto, ahora se da la opción de no actualizar el Cli si hay una nueva versión
  - Se cambia `node:fs.watch` por `chokidar.watch` ya que mejora el rendimiento
  - Se ha renombrado el script para regenerar el Cli, para diferenciarlo del compilador de los proyectos

---
## 2024.10.30+1

### Fixed
- [Jose] Corregida la detección erronea de cambios en i18n que regeneraba las traducciones sin parar

---
## 2024.10.29+1

### Added
- [Jose] Añadida documentación de opciones de `mrpack` en el archivo [`scripts.md`](./scripts.md)
- [Jose] Añadida opción para resetear los frameworks a la versión publicada (descarta los cambios locales)
  ```bash
    yarn mrpack framework --reset
  ```

### Changed
- [Jose] Forzado el tipado de `node` a la versión `^22`

### Deleted
- [Jose] Eliminado el atajo `Doctor` que no se utilizaba
    - Se sigue pudiendo invocar con el comando `yarn run doctor`

### Fixed
- [Jose] Corregido error que hacía los nuevos archivos se interpretaran como directorios por lo que daban error al descargar

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.8.2

---
## 2024.10.28+1

### Fixed
- [Jose] Corregido error a la hora de detectar cambios en directorios
- [Jose] Corregido reseteo de versión al compilar

---
## 2024.10.25+1

### Fixed
- [Jose] Correcciones varias de estabilidad

---
## 2024.10.24+1

### Fixed
- [Jose] Correcciones varias de estabilidad

---
## 2024.10.23+1

### Added
- [Jose] Se ha migrado las herramientas, la configuración de compilación y la información para desplegar desde el viejo workspace `framework/services-comun`
    - Las clases utilizadas en este workspace no se exportan fuera del mismo, son privadas por lo que no son accesibles desde el resto de workspaces
    - Las herramientas no se almacenan compiladas en el repositorio, si se intentan lanzar antes de compilarlas primero se autocompilan por si mismas
