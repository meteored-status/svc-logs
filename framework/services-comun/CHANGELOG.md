# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.7.14+1

### Removed
- [Jose] `modules/frontend/critical.ts`, `modules/frontend/metatags.ts`, `modules/frontend/miga.ts`,
  `modules/frontend/pagina.ts`, `modules/frontend/plantilla.ts` — trasladados a
  `@mr/core/templates/src/legacy/*`, expuestos ahora como `@mr/core-templates/legacy/*`
  (puente de compatibilidad; ver [`@mr/core/templates/CHANGELOG.md`](../../@mr/core/templates/CHANGELOG.md)).
  Migración automática de imports disponible vía el sistema de patches
  (`@mr/core/dev/patches/`, regla `R034`): `yarn run patch:apply`.
- [Jose] `package.json` — eliminada la `devDependency` `@mr/core-templates`. Era la única razón
  por la que `services-comun` dependía de este paquete; tras el punto anterior, `services-comun`
  **ya no depende de `@mr/core-templates`**. Los proyectos que dependan de `services-comun` pero no
  usen el sistema de plantillas (`Plantilla`/`Componente`/`legacy/*`) ya no necesitan instalar
  `@mr/core-templates` como dependencia transitiva; solo deben añadirlo explícitamente los
  workspaces que realmente lo usen.

---

## 2026.7.13

### Changed
- [Jose] `package.json` — `dd-trace` actualizado de `^5.113.0` a `^6.2.0`. Revisado el
  *changelog* oficial del major: los *breaking changes* de la v6 (Node.js ≥22 como mínimo
  soportado, retirada de APIs ya deprecadas de AppSec/plugins y cambios en Test Optimization)
  no afectan al uso actual en `modules/utiles/log.ts` (`tracer.init()`, `tracer.trace`,
  `formats` de `dd-trace/ext`). Sin cambios de código necesarios.

---

## 2026.7.3+1

### Changed
- [Juan Carlos] `modules/database/transaction/transaction.ts` — migrada la función decoradora `transactional` desde la firma legacy de TypeScript (`target/propertyKey/descriptor`) a la firma moderna con `ClassMethodDecoratorContext`, manteniendo la misma lógica de control transaccional (`BEGIN`/`JOIN`/`COMMIT`/`ROLLBACK`/`LEAVE`) y alineando la compilación con el modelo actual de decoradores.

---

## 2026.7.2+1

### Removed
- [José] `package.json` — eliminada la dependencia `diff3`/`@types/diff3` (patcheada temporalmente
  a raíz de un bug en `diff3@0.0.4`). Quedó huérfana tras trasladarse `merge3` a
  `@mr/cli/src/mrpack/utiles/merge.ts`, que ahora usa `node-diff3` en su lugar; no había ningún
  import de `diff3` en `services-comun`.

---
## 2026.6.29+1

### Changed
- [Juan Carlos] `modules/database/redis/index.ts` — `IRedisCluster.primary` ahora acepta `IRedis | IRedis[]` y `Redis` normaliza la configuracion a una lista de primarios para soportar 1 o mas nodos de escritura.
- [Juan Carlos] `modules/database/redis/index.ts` — las operaciones de escritura y lock (`set`, `bulkSet`, `aquireLock`, `releaseLock`) pasan de usar un unico `primary` a ejecutar sobre todos los clientes de `cluster.primaries` con `Promise.all`.
- [Juan Carlos] `modules/database/redis/index.ts` — `RedisCluster` sustituye `_primaryClient` por `_primaryClients`, expone el getter `primaries` y actualiza la creacion/conexion para inicializar todos los primarios declarados.
- [Juan Carlos] `modules/database/redis/index.ts` — ajustado el cierre de conexiones en `asyncDispose` y `disconnectPrimaries` para distinguir cuando `read` comparte instancia con el primer `primary`, evitando dobles `quit()` y limpiando correctamente el estado interno.
- [Juan Carlos] `modules/database/redis/index.ts` — la clase `Redis` pasa de implementar `Disposable` a `AsyncDisposable`, reemplazando `[Symbol.dispose](): void` por `async [Symbol.asyncDispose](): Promise<void>` para awaitar correctamente la resolución del clúster antes de liberar recursos.
- [Juan Carlos] `modules/database/redis/index.ts` — la clase interna `RedisCluster` pasa igualmente de `Disposable` a `AsyncDisposable`, sustituyendo el encadenamiento `.then()` en `[Symbol.dispose]` por `await` explícito en `[Symbol.asyncDispose]`, garantizando que los clientes primario y de lectura se cierran con `await client.quit()` antes de registrar el log de desconexión.

---
## 2026.6.17+6

### Added
- `modules/traduccion/v2/util/plural-function-builder.ts` — nuevo helper `pluralBuilder(lang)` para construir funciones de pluralizacion a partir de `Intl.PluralRules`, con fallback de locale abreviado y fallback final a `en-US`.

### Changed
- `modules/traduccion/v2/value/plural-value.ts` — anadido el tipo exportado `TPluralFunction` y tipado del constructor de `PluralValue` actualizado para reutilizarlo.
- `modules/traduccion/v2/example.ts` — el ejemplo de uso de `PluralValue` deja de importar `make-plural/cardinals` y pasa a usar `pluralBuilder("es")`.

### Removed
- `package.json` — eliminada la dependencia `make-plural`, ya no necesaria tras migrar la construccion de reglas de plural al runtime de `Intl`.

---
## 2026.6.17+1

### Changed
- [Juan Carlos] `modules/database/redis/index.ts` — eliminado el uso de `PromiseTimeout` en operaciones de acceso (`get`, `set`, `searchKeys`, `aquireLock`, `releaseLock`) para evitar timeouts artificiales de capa aplicación sobre promesas de cliente.
- [Juan Carlos] `modules/database/redis/index.ts` — los timeouts pasan a controlarse en la construcción de `createClient`, configurando `socket.connectTimeout` (con `clientTimeout`) y `commandOptions.timeout` (con `timeout`) con fallback a defaults de `RedisCluster`.
- [Juan Carlos] `modules/database/redis/index.ts` — simplificada la creación del clúster Redis: `Redis` delega la gestión de defaults de timeout en `RedisCluster`, que ahora centraliza `MAX_REDIS_GET_CLIENT_MS` y `MAX_REDIS_GET_MS`.

---
## 2026.6.16+1

### Added
- [Juan Carlos] `modules/database/postgresql/index.ts` — nueva interfaz exportada `IPostgreSQLConnectionOptions` con las propiedades opcionales `max`, `idleTimeoutMillis` y `connectionTimeoutMillis` para configurar el pool de conexiones de `pg`.
- [Juan Carlos] `modules/database/postgresql/index.ts` — `IPostgreSQLBuild` expone el nuevo campo `options?: IPostgreSQLConnectionOptions`, que se propaga desde `PostgreSQL.build()` hasta el constructor, permitiendo personalizar el pool sin modificar las credenciales JSON.
- [Juan Carlos] `modules/database/postgresql/index.ts` — `IPostgreSQLCommon` ahora extiende `IPostgreSQLConnectionOptions`, unificando las propiedades compartidas de conexión y las del pool en una sola jerarquía.
- [Juan Carlos] `modules/database/alloydb/index.ts` — nueva interfaz `IAlloyDBConnectionOptions` que extiende `IPostgreSQLConnectionOptions`, preparando la subclase para opciones específicas de AlloyDB en el futuro. El campo `options` se propaga a través de `AlloyDB.build()` y el constructor hacia `PostgreSQL`.

### Changed
- [Juan Carlos] `modules/database/postgresql/index.ts` — `PostgreSQL` pasa de `Disposable` a `AsyncDisposable` e implementa `public async [Symbol.asyncDispose](): Promise<void>`, esperando de forma explícita la finalización de `reset()` durante la liberación de recursos.
- [Juan Carlos] `modules/utiles/postgres.ts` — la instancia global se declara con `await using db = PostgreSQL.build();` para alinear el ciclo de vida con `AsyncDisposable` y permitir limpieza asíncrona automática al salir del módulo.

---
## 2026.6.2+1

### Fixed
- [Juan Carlos] `modules/net/cache/redis.ts` — corregido bug en `NetCacheRedis.redis()` donde las opciones de timeout se expandían con spread (`...options`) en el nivel raíz del objeto de `Redis.build()`, en lugar de pasarse como campo `options` anidado según la firma de `IRedisBuild`. Las opciones nunca llegaban al cliente Redis.

### Updated
- [Juan Carlos] Añadida documentación TSDoc en `modules/messages/pubsub/v2/utiles/message-manager.ts`.

---
## 2026.5.18+1

### Changed
- [Jose] `modules/utiles/log.ts` — **logging estructurado JSON para Cloud Logging y Datadog**:
  - Cuando `KUBERNETES=true` se emite siempre JSON (no solo cuando `DATADOG=true` y hay span activo).
  - Cada entrada incluye `timestamp`, `severity` (`INFO`/`WARNING`/`ERROR`/`DEBUG` — formato Cloud Logging)
    y `message`. Cuando hay span de `dd-trace` activo se inyecta el contexto de traza (`dd.trace_id`,
    `dd.span_id`) para correlacionar logs con trazas.
  - Si el primer argumento de `info/warning/error/debug` es un objeto plano, sus claves se promueven
    al nivel raíz del payload, permitiendo p. ej. `info({event:"http.request", status:200, latency_ms:42})`
    y obtener campos indexables en lugar de un string opaco.
  - Los `Error` se serializan preservando `name`/`message`/`stack`.
  - En desarrollo local se mantiene el formato legible previo (prefijo `ESTATICO + args`).
  - **Bugfix**: `error()` ahora emite con nivel `error` (antes emitía con nivel `warn`, lo que producía
    `severity: WARNING` en los logs estructurados).
- [Jose] `modules/engine_server.ts` — `EngineServer.prebuild` deja de mutar
  `Respuesta.SERVICE/POD/ZONA/VERSION` y pasa a inicializar el contexto de cabeceras
  HTTP mediante `Respuesta.setContextoDefecto({service, pod, zona, version})`.
  Esto elimina estado global mutable campo a campo en `@mr/core-network/server/http/respuesta`.

---
## 2026.5.5+1

### Added
- [Juan Carlos] Añadido soporte en `SparkPostManager` para campañas por listas de destinatarios:
  - `createRecipientList`
  - `addRecipientsToList`
  - `sendToList`
- [Juan Carlos] Añadidos métodos para gestión de listas en SparkPost:
  - `getAllRecipientLists`
  - `deleteRecipientList`
- [Juan Carlos] Añadido método `getRecipientList` para consultar listas con sus destinatarios.

### Changed
- [Juan Carlos] Mejorada la carga de credenciales en `SparkPostManager.build` para soportar configuración separada de cliente (`client`) y administrador (`admin`).
- [Juan Carlos] Separada la inicialización lazy de clientes (`getClient` y `getAdminClient`) para diferenciar operaciones de envío directo y operaciones administrativas.

### Updated
- [Juan Carlos] Añadida documentación TSDoc en `modules/email/managers/spark_post.ts`.

---
## 2025.9.2+1

## Added

- [Juan Carlos] Añadida implementación de `NetCache` para `Redis`.
---
## 2025.7.22+1

### Fixed
- [Jose] Refactor de la conexión a MySQL

---
## 2025.5.15+1

### Fixed
- [Jose] Corregido el tamaño límite de archivos enviados por POST

---
## 2025.5.13+1

### Updated
- [Juan Carlos] Update de librerías:
    - [isbot](https://www.npmjs.com/package/isbot) 5.1.28

---
## 2025.5.8+1

### Updated
- [Juan Carlos] Update de librerías:
    - [mysql2](https://www.npmjs.com/package/mysql2) 3.14.1
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.16
    - [isbot](https://www.npmjs.com/package/isbot) 5.1.27

---
## 2025.4.21+1

### Fixed
- [Juan Carlos] Corregido error en el parser de calendarios de Google Calendar para identificar eventos de recurrencia, dentro de un evento.

---
## 2025.3.24+1

### Updated
- [Jose] Update de librerías:
    - [@sequelize/core](https://www.npmjs.com/package/@sequelize/core) 7.0.0-alpha.46
    - [@tsconfig/node22](https://www.npmjs.com/package/@tsconfig/node22) 22.0.1
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.13.13
    - [isbot](https://www.npmjs.com/package/isbot) 5.1.25
    - [mysql2](https://www.npmjs.com/package/mysql2) 3.14.0

---
## 2025.3.12+1

### Changed
- [Jose] Awaited algunas funciones async en algunas clases core del engine
- [Jose] Cuando el nombre de la base de datos se carga desde la constante de proyecto, se permiten sustituciones de
  parámetros. Actualmente se implementan:
    - `{CLIENTE}`: Se sustituye por la variable de entorno `CLIENTE` o la cadena vacía en caso de no existir

---

## 2025.2.10+2

### Added
- [Juan Carlos] Se crea la clase abstracta `Transaction` para manejar transacciones de base de datos.
- [Juan Carlos] Se crea una clase para la gestión de transacciones `TransactionManager` que permite realizar
  transacciones de forma sencilla sin tener en cuenta la implementación de la transacción.
- [Juan Carlos] Se crea la función `transactional` que permite crear una transacción a través de un
  `TransactionManager`. Esta función recibe como parámetro una función que devuelve un objeto `TransactionManager` y un
  nombre (opcional).
- [Juan Carlos] Se crea una clase `MySQLTransactionManager` para manejar transacciones de MySQL.
- [Juan Carlos] Se hace que la clase `Transaction` de MySQL extienda de la clase `Transaction` abstracta.

```typescript
@transactional(() => new MySQLTransactionManager(), 'Mi Transacción')
function myMethod(transaction?: Transaction): void {
    // Código a ejecutar
}
```

### Deprecated
- [Juan Carlos] Se deprecia la función `transactional` de la clase `Transaction` de MySQL.

---
## 2025.1.30+1

### Updated
- [Jose] Eliminado directorio `despliegue` ya que ya no se gestiona desde este workspace

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
