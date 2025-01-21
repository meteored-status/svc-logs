# [Changelog](https://keepachangelog.com/en/1.1.0/)

---
## 2025.1.16+2

### Updated
- [Juan Carlos] Update de librerías:
  - [chokidar](https://www.npmjs.com/package/chokidar) 4.0.3
---
## 2025.1.15+1

### Added
- [Jose] Se ha añadido un método nuevo para añadir una caché de 1 año en los handlers de respuesta

---
## 2024.12.12+1

### Added
- [Jose] En los Scripts en Bulk de Elastic ahora se puede indicar el documento a indexar en caso de no existir el documento indicado

---
## 2024.12.16+1

### Updated
- [Jose] Update de librerías:
    - [@elastic/elasticsearch](https://www.npmjs.com/package/@elastic/elasticsearch) 8.17.0
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.2

---
## 2024.12.12+1

### Added
- [Jose] Se ha añadido la posibilidad de usar caché en las consultas de MySQL
  - El objeto de configuración que se pasa como tercer parámetro a `db.select` y `db.selectOne` tiene una nueva propiedad `cache` que se puede usar para configurar el cacheo de la consulta:
    ```typescript
    interface ICacheConfig {
      builder: ICacheBuilder; // builder del gestor de caché
      cleanup?: boolean; // indica si se ha de programar el elemento para eliminarse de la caché al caducar
      key?: string|number; // key para la caché
      expires?: Date; // fecha caducidad del valor cacheado
      ttl?: number;   // tiempo de vida del valor cacheado en segundos
    }
    ```
    - `builder`: Es el builder del gestor de caché que se va a usar, actualmente se encuentran implementados estos 3:
      - `mock`: No guarda nada, solo simula que guarda
      - `memory`: Guarda en memoria
      - `disk`: Guarda en un directorio del disco duro
      - ***Nota***: Se pueden añadir el builder tal cual o la salida del método `.config()` del builder elegido para pasarle configuración
    - `cleanup`: Indica si se ha de programar el elemento para eliminarse de la caché al caducar, cada builder tiene un valor por defecto si no se especifica
    - `key`: Es la key que se va a utilizar para cachear la consulta, si no se especifica se genera a partir de los parámetros
    - `expires`: Es la fecha de caducidad del valor cacheado, si no se especifica no caduca
    - `ttl`: Es el tiempo de vida del valor cacheado en segundos, si no se especifica no caduca
    - ***Nota***: `ttl` tiene preferencia sobre `expires`
    - ***Nota 2***: Si no se especifica `expires` ni `ttl` entonces la consulta no caducará nunca

### Deprecated
- [Jose] Se ha deprecado los métodos `db.query` y `db.queryOne` de MySQL, ahora se debe usar `db.select` y `db.selectOne` respectivamente en su lugar

---
## 2024.12.4+1

### Changed
- [Jose] Se ha refactorizado el módulo `next.config.js`

---
## 2024.12.5+1

### Updated
- [Jose] Update de librerías:
    - [@opentelemetry/core](https://www.npmjs.com/package/@opentelemetry/core) 1.29.0
    - [@opentelemetry/instrumentation](https://www.npmjs.com/package/@opentelemetry/instrumentation) 0.56.0
    - [@opentelemetry/instrumentation-http](https://www.npmjs.com/package/@opentelemetry/instrumentation-http) 0.56.0
    - [@opentelemetry/resources](https://www.npmjs.com/package/@opentelemetry/resources) 1.29.0
    - [@opentelemetry/sdk-trace-base](https://www.npmjs.com/package/@opentelemetry/sdk-trace-base) 1.29.0
    - [@opentelemetry/sdk-trace-node](https://www.npmjs.com/package/@opentelemetry/sdk-trace-node) 1.29.0

---
## 2024.12.3+1

### Added
- [Jose] Añadida clase BulkAuto en `services-comun/modules/elasticsearch/bulk/auto`
  - Se crea como la clase Bulk con una opción de configuración extra (`interval`) que indica el intervalo mínimo de envíos
  - Una vez creada la instancia, se ha de iniciar el envío llamando al método `.start()` y al terminar se debe detener el envío llamando al método `.end()`
  - Al detener el envío se programa un último envío si hay operaciones pendientes
- [Jose] Añadidas clases para el manejo de errores de Elastic

### Changed
- [Jose] Se han eliminado los `prepared statements` ya que no funcionan según lo esperado

### Updated
- [Jose] Update de librerías:
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.0

---
## 2024.12.2+1

### Changed
- [Jose] Se ha añadido soporte a cacheo de `prepared statements` en mysql (habilitado por defecto)
  - Esto debería mejorar el rendimiento de las consultas (de las bien construidas con parámetros)
  - Se puede deshabilitar pasando la opción `statementCache: false` del objeto de configuración de cada consulta
  - Nota: La caché no está habilitada en transacciones

---
## 2024.12.1+1

### Fixed
- [Jose] Solucionado warning producido en determinadas circunstandcias cuando un servicio se inicia como cluster y utiliza TLS en alguna dependencia

---
## 2024.11.30+1

### Changed
- [Jose] Corregidos los tipos genéricos de la clase `Bulk` de ElasticSearch
- [Jose] Todas las clases Operacion de Bulk ahora son finales (no se pueden extender)

### Fixed
- [Jose] Corregido memory leak en el método `bulk` de ElasticSearch
  - Se abría la conexión pero nunca se cerraba

---
## 2024.11.29+1

### Added
- [Jose] Añadidas estadísticas al nuevo módulo de Bulk

### Changed [BREAKING]
- [Jose] Se ha movido el módulo `modules/elasticsearch/elastic/bulk` a `modules/elasticsearch/elastic/bulk-old`:
    - El módulo `modules/utiles/elastic/bulk` ahora apunta a la ruta nueva por lo que no sería necesario hacer cambios en la mayoría de los casos
- [Jose] Se ha movido el módulo `modules/elasticsearch/elastic/bloque` a `modules/elasticsearch/elastic/bulk`:
    - En este caso sí que habría que renombrar las importaciones

### Changed
- [Jose] Se ha mejorado el método `arrayChop` de `modules/utiles/array.ts`. Ahora el parámetro `length` es opcional y si solo hay 1 bloque se devuelve tal cual sin procesar nada

---
## 2024.11.28+1

### Changed
- [Jose] Nuevo tipado para operaciones Bulk de ElasticSearch
- [Jose] Incrementado timeout de ElasticSearch a 60sg
- [Jose] Se ha añadido una nueva clase Bulk en `services-comun/modules/elasticsearch/bloque` para gestionar los envíos en Bulk de forma controlada
  - En esta nueva funcionalidad, se crea un objeto bulk, se le añaden operaciones y se envía el bloque manualmente
  ```typescript
  /**
    * elastic: Elasticsearch => Instancia de ElasticSearch
    * indice1?: string       => Nombre del índice por defecto para este bulk
    * indice2?: string       => Índice para esta operación
    * id?: string            => ID del documento
    * doc: any               => Documento
    * ok: boolean            => Resultado de la operación completa
  */
  const bulk = Bulk().init(elastic, indice1);
  const promesa = bulk.index({index: indice2, id: id, doc: doc});
  // ...
  const ok = await bulk.run();
  ```
- [Jose] Se ha eliminado la fecha de commit del compilador, así se evita que se generen nuevos contenedores en cada despliegue

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.1

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
- [Jose] Eliminada información de despliegue. Se ha transferido a `@mr/cli`

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
