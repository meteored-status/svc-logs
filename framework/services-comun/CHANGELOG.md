# [Changelog](https://keepachangelog.com/en/1.1.0/)

---
## 2024.11.14+1
### Updated
- [Jose] Update de librerías:
  - [@google-cloud/pubsub](https://www.npmjs.com/package/@google-cloud/pubsub) 4.9.0

---
## 2024.11.13+1
### Updated
- [Jose] Limpieza de librerías que ya no son necesarias
- [Jose] Eliminado antiguo Cli que solo se usaba para migrar a la nueva versión

---
## 2024.11.04+1
### Updated
- [Juan Carlos] Update de librerías:
  - [node-ical](https://www.npmjs.com/package/node-ical) 0.20.1
  - [tslib](https://www.npmjs.com/package/tslib) 2.8.1
  - [webpack](https://www.npmjs.com/package/webpack) 5.96.1

---
## 2024.10.29+1

### Changed
- [Jose] Sustituída la librería `@tsconfig/node20` por la librería `@tsconfig/node22`

### Fixed
- [Jose] Corregido parseo de POST cuando el content/type es `application/x-www-form-urlencoded`

### Updated
- [Jose] Update de librerías:
  - [@types/node](https://www.npmjs.com/package/@types/node) 22.8.2
  - [node-ical](https://www.npmjs.com/package/node-ical) 0.20.0

---
## 2024.10.23+1

### Changed
- [Jose] Se ha migrado las herramientas y la configuración de compilación al nuevo workspace `@mr/cli`
  - Las clases utilizadas en este workspace no se exportan fuera del mismo, son privadas por lo que no son accesibles desde el resto de workspaces
  - Las herramientas no se almacenan compiladas en el repositorio, si se intentan lanzar antes de compilarlas primero se autocompilan por si mismas

---
## 2024.10.22+1

### Changed
- [Jose] Refactorizado `ADD` de frameworks ***(BETA)***
- [Jose] Refactorizado `PUSH` de frameworks ***(BETA)***: Ahora solo se suben los ficheros que cambian
- [Jose] Refactorizado `PULL` de frameworks ***(BETA)***: Ahora solo se descargan los ficheros que cambian y se mergean los modificados

### Added
- [Jose] Añadida opción para actualizar el framework: `yarn mrpack framework --update` sin actualizar otras cosas
- [Jose] Añadida función `merge3`para hacer un merge a 3 bandas de strings en `services-comun/modules/utiles/string.ts`
- [Jose] Añadidas librerías:
  - [@types/diff3](https://www.npmjs.com/package/@tytpes/diff3) 0.0.2
  - [diff3](https://www.npmjs.com/package/diff3) 0.0.4

---

## 2024.10.21+1

### Updated
- [Juanmi] Update de librerías:
  - [formidable](https://www.npmjs.com/package/formidable) 3.5.2
  - [hexoid](https://www.npmjs.com/package/hexoid) 2.0.0 *(tras update de `formidable`)*
- [Jose] Update de librerías:
  - [@types/node](https://www.npmjs.com/package/@types/node) 20.16.13
  - [sass](https://www.npmjs.com/package/sass) 1.80.3

## 2024.10.18+1

### Fixed
- [Juan Carlos] Se fuerza a que la versión de `hexoid` sea `1.0.0` hasta que `formidable` actualice también su versión a la `2.0.0` de `hexoid`

## 2024.10.16+1

### Added
- [Jose] Añadida clase `Deferred` en `services-comun/modules/utiles/promise`
    ```typescript
    const deferred = new Deferred<number>();

    deferred.promise.then((value) => {
        console.log("Resuelta con el valor:", value);
    }).catch((error) => {
        console.error("Rechazada con el error:", error);
    });

    // Puedes resolver o rechazar la promesa desde fuera
    deferred.resolve(42);
    deferred.reject(new Error("Algo ha ido mal"));
    ```

### Fixed
- [Jose] El generador de `i18n` iniciaba 2 instancias en lugar de 1
- [Jose] El compilador ahora espera a que el generador de `i18n` termine antes de iniciar la compilación del resto de workspaces

### Updated
- [Jose] Update de librerías:
  - [@elastic/elasticsearch](https://www.npmjs.com/package/@elastic/elasticsearch) 8.15.1
  - [@google-cloud/pubsub](https://www.npmjs.com/package/@google-cloud/pubsub) 4.8.0
  - [tslib](https://www.npmjs.com/package/tslib) 2.8.0

---
## 2024.10.11+1

### Updated
- [Jose] Update de librerías:
  - [sass](https://www.npmjs.com/package/sass) 1.79.5
  - [typescript](https://www.npmjs.com/package/typescript) 5.6.3
- [Jose] Añadido `.dev.vars` a la lista de archivos ignorados por git

---
## 2024.10.8+1

### Changed [BREAKING]
- [Jose] Se ha refactorizado el módulo `modules/elasticsearch/elastic`:
  - El objeto `elasticsearch` ahora se exporta desde `modules/utiles/elastic`
  - Para arreglar el *breaking change* se ha de reemplazar
    ```typescript
       import elasticsearch from "services-comun/modules/elasticsearch/elastic";
    ```
    por
    ```typescript
       import elasticsearch from "services-comun/modules/utiles/elastic";
    ```

- [Jose] Se ha refactorizado el módulo `modules/elasticsearch/bulk`:
  - El objeto `bulk` ahora se exporta desde `modules/utiles/elastic/bulk`
  - Para arreglar el *breaking change* se ha de reemplazar
    ```typescript
       import bulk from "services-comun/modules/elasticsearch/bulk";
    ```
    por
    ```typescript
       import bulk from "services-comun/modules/utiles/elastic/bulk";
    ```

---
## 2024.10.7+1

### Changed
- [Jose] Se ha desactivado los warnings de NodeJS en producción para los `DeprecationWarning`

### Updated
- [Jose] Update de librerías:
  - [@sequelize/core](https://www.npmjs.com/package/@sequelize/core) 7.0.0-alpha.43

---
## 2024.10.3+1

### Added
- [Jose] Añadido soporte a indicar el idioma por defecto de las traducciones
  - Anteriormente, el idioma por defecto era `en`
  - Esto se indica en el `package.json` del proyecto `i18n`
  ```yaml
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
## 2024.10.2+2

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
## 2024.10.2+1

### Changed
- [Jose] Se ha cambiado el framework de traducciones:
  - Ahora se generan menos chunks al compartirse traducciones heredadas
  - Se ha optimizado el código generado
