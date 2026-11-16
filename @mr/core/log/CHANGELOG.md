# [Changelog](https://keepachangelog.com/en/1.1.0/) — `@mr/core-log`

---

## 2026.9.23 09:25 — [Jose]

### Changed

- **Código adaptado a `yarn lint`** (`@mr/core-lint`), sin cambios de comportamiento: `import type` en los
  imports que solo traen tipos, llaves en todos los `if`/`else`/`for`/`while`, bloques de imports en su orden
  y separados por una línea en blanco, fuera las dobles líneas en blanco, `Tipo[]` en vez de `Array<Tipo>` y
  sin `/* STATIC */` en las clases que no tienen estáticos. Casi todo con el autofix; el orden de imports,
  con un codemod que solo movía líneas enteras.
- **La documentación de los miembros de `interface.ts` pasa al bloque JSDoc de cada tipo** (`@property`), como pide la convención.

## 2026.9.14 08:11 — [Jose]

### Added

- **`region` y `host` en el log**: dónde corre el proceso y qué máquina o pod lo escribió. Se dan al
  construir el `Logger` (`ILoggerConfig`), no en cada llamada, porque no cambian entre dos logs del mismo
  proceso; viajan en `ILogEmitido` y en `IWire`, y el destino los copia al cuerpo de la entrega.

  Lo que separan es lo que no se sabía: el mismo servicio corre en varios clusteres y con varias réplicas,
  así que sin esto una pasada de Bélgica y otra de Madrid, o dos pods de los que solo uno falla, se leen
  como si fueran el mismo proceso.

  **Los dos son opcionales**, y desde el navegador no van: que falten dice la verdad.

- **`@mr/core-log/pod`**, un punto de entrada solo de Node con `loggerDePod()` y `servicioDePod()`. Monta
  el logger de un servicio con lo que ya dice su `IPodInfo`: el nombre con el que se firma —
  `<namespace>/<servicio>`, de `DD_SERVICE` o compuesto con `K8S_NAMESPACE`—, la zona y el host. Un emisor
  queda en una línea, y la convención deja de estar copiada en cada uno.

  Está **aparte de `logger.ts` porque lee `process.env`**, y aquel tiene que poder cargarse en el navegador
  —lo comprueba `tsconfig.browser.json`, que lista sus ficheros uno a uno—. Misma separación que ya había
  entre `destino/http` y `destino/websocket`.

  Que esté aquí no es comodidad: ese nombre lo componen ya por su cuenta el `run.sh` del `Dockerfile` (para
  Datadog) y los prefijos de clave de redis y de valkey, y cada emisor nuevo sería un cuarto sitio donde
  equivocarse distinto. Seis comprobaciones, una por rama, incluida la del fallo que ya dio una vez: un
  `DD_SERVICE` **definido y vacío** firmaba todos los logs con el servicio en blanco, porque el respaldo
  iba con `??` en vez de mirar la longitud.

- **`ILoggerConfig` acepta `pod`** (`IOrigen`), del que salen `servicio`, `region` y `host`. Los tres
  sueltos siguen valiendo y **ganan al pod**, que es lo que permite quedarse con el resto y corregir uno.
  `IOrigen` declara solo los tres campos en vez de importar `IPodInfo`, que arrastraría `node:os` y
  `services-comun` a un paquete que tiene que servir en el navegador: TypeScript es estructural, así que
  un `IPodInfo` encaja tal cual.

  **Una cadena vacía cuenta como no tenerlos** y el campo no viaja: es lo que devuelve un `process.env` que
  no está puesto, o sea el caso normal en local, y un campo en blanco en el registro se lee como un dato.

  Seis comprobaciones nuevas (cuatro en `logger.spec.ts`, dos en `destino-http.spec.ts`). Las dos del
  destino son las que importan de verdad: `serializar()` monta el cuerpo campo a campo, así que un campo
  que se añada al `Logger` y no ahí se queda en el emisor sin que falle nada — el logger lo lleva, sus
  pruebas pasan y a la ingesta no llega. Comprobado rompiéndolo: con esas dos pruebas la mutación se caza,
  sin ellas pasaba en verde.

---

## 2026.9.9 08:19 — [Jose]

### Added

- **`DestinoHTTP`**: la misma ingesta por `POST` en vez de por WebSocket. Mismo cuerpo, misma
  agrupación, misma urgencia. Medido contra un servidor real: 52 logs en 4 peticiones sobre **2
  conexiones TCP**, con su `content-type` y su URL.

  Trae dos cosas que el de WebSocket no puede dar. **Sirve en el navegador**, porque solo usa `fetch`, así
  que no hay que escribir un destino por sitio. Y **se entera de que falla**: un 500 se traza igual que un
  fallo de red, mientras que el `head()` del WebSocket no contesta nada. Sigue sin haber acuse de que el
  log se *indexó* —la ingesta contesta antes de indexar—, pero al menos se sabe que llegó.

  Ojo con el clásico: `fetch` **no rechaza por un 4xx ni un 5xx**, solo por un fallo de red. Sin mirar
  `respuesta.ok`, una ingesta devolviendo 500 se vería igual que una que funciona. Hay prueba, y se la ha
  visto fallar.

- **`DestinoBuffer`**, la clase base con todo lo que no depende del transporte: buffer, urgencia, cola,
  techo de pendientes, `vaciar()` y los avisos con cuentagotas. Escribir un destino nuevo es implementar
  `entregar()`, y a veces `liberar()`.

  De eso hay bastante más de lo que parecía: `websocket.ts` pasa de 362 líneas a 96, y `http.ts` son 75
  con la misma funcionalidad. Es lo que hace que elegir transporte sea barato de verdad — una línea en el
  arranque del servicio.

### Changed

- **Las pruebas del destino pasan al arnés del workspace**, a través de `DestinoHTTP`, que sí se puede
  cargar sin bundler. Como la lógica está en la base, lo que se comprueba por HTTP vale para los dos. Eran
  comprobaciones sueltas fuera del repositorio; ahora son 7 pruebas que corren con `yarn workspace
  @mr/core-log test`, y las tres que cubren urgencia y control de estado se han visto fallar.

- `base.ts` y `http.ts` entran en `tsconfig.browser.json`: lo utilizable desde el navegador pasa de dos
  ficheros a cuatro, y sigue vigilado antes que nada en el script `test`.

---

## 2026.9.8 21:05 — [Jose]

### Added

- **`Logger.vaciar()`**, que resuelve cuando ha salido lo que estuviera pendiente al llamarla, y deja el
  logger utilizable. Es lo que hay que esperar antes de dejar morir un proceso —un cronjob que termina,
  un `Engine` que baja—: los destinos agrupan y encolan, así que lo último que se escribe es justo lo que
  se pierde, y en un cronjob lo último suele ser el resultado. `IDestino.vaciar()` es opcional; un
  destino que escriba directo no tiene nada que vaciar. `cerrar()` pasa a ser `vaciar()` + soltar el pool.

  En `DestinoWebSocket` es **un** `await this.cola`, no dos: `despachar()` reasigna `this.cola`
  encadenando el frame nuevo, así que la que se lee tras volcar ya incluye los dos volcados. Un segundo
  `await` arrastraría además lo que otro encolase mientras tanto, y eso volvería indeterminado lo que el
  método promete.

### Changed

- **`IWire.severidad` pasa de cadena a número.** Se guardaba como cadena con un número dentro —herencia
  de `logs-web`, con un `parseInt` en el lector— y llevaba años así porque cambiarlo era migrar el
  índice. El data stream estaba vacío, así que se ha podido arreglar: en Elasticsearch pasa a `byte`.

  Los emisores que la sigan mandando como texto no se rompen: la ingesta la normaliza antes de indexar, y
  aunque no lo hiciera, Elasticsearch convierte solo las cadenas numéricas.

---

## 2026.9.8 20:10 — [Jose]

### Added

- **`EEntorno` y el entorno en el log**: desarrollo, test o producción, sellado por el `Logger` como el
  proyecto y el servicio. Se deduce con `entornoActual()` de las constantes que inlina el bundler, y se
  puede imponer con `Logger.build({..., entorno})`.

  **Se pregunta por `TEST` antes que por `PRODUCCION`**, que es lo contrario de lo intuitivo: el contrato
  de `@mr/core-dev` es que test también lleva `PRODUCCION=true`, así que el orden natural etiquetaría
  todo test como producción. Hay prueba de esa combinación concreta, y se la ha visto fallar con el orden
  invertido.

  Las constantes se leen con `typeof` porque este paquete puede ejecutarse sin pasar por el bundler —sus
  propias pruebas, sin ir más lejos—, donde el identificador no existe y leerlo sería un `ReferenceError`.
  Cuando sí las inlina no cuesta nada: `typeof true` se pliega en compilación. Comprobado de las dos
  formas: `0` (desarrollo) en las pruebas y `2` (producción) en el bundle.

- Numérico, como `ESeveridad`, pero **viaja como número y no como cadena**: la severidad se guarda como
  cadena con un número dentro porque así se indexó hace años y cambiarlo sería migrar el índice; esto es
  campo nuevo y no hay por qué heredar el apaño.

- `IWire.entorno` es **opcional**, por lo mismo que `timestamp`: los emisores que no usan este paquete no
  lo mandan. Cuando no viene, la ingesta no lo indexa en vez de poner uno por defecto — un log sin
  entorno es un log del que no se sabe, no un log de desarrollo.

### Changed

- `tsconfig.browser.json` pasa de `types: []` a `types: ["@mr/core-dev"]`, que es lo que declara los
  globales del bundler. Sigue sin `@types/node`, y sigue mordiendo: comprobado metiendo un `import` de
  `node:os` en `logger.ts`.
- `tsconfig.spec.json` añade `@mr/core-dev` a sus `types`, por lo mismo.

---

## 2026.9.8 19:25 — [Jose]

### Changed

- **El `socket` tiene valor por defecto**, `https://status.meteored.com`, que es donde publican los
  servicios del dominio status. Es el mismo para todos los proyectos que loguean, así que quien no tenga
  nada especial que decir ya no tiene que decirlo: `new DestinoWebSocket()` vale para producción. Se
  sigue pudiendo cambiar para un entorno de pruebas o para ir directo al servicio desde dentro del
  clúster.

---

## 2026.9.8 18:40 — [Jose]

### Added

- **Los logs van agrupados por frame**: hasta `lote` (100) por envío, o lo que haya cuando vencen
  `esperaMs` (1000 ms) desde el primero. Medido contra un servidor real: 53 logs en 3 frames con
  `lote: 20`, por una sola conexión.

  Lo que ahorra **no está en Elasticsearch** —el `BulkAuto` del receptor ya junta lo que le llega cada
  segundo—, está en el camino: cada frame que entra abre un span de Datadog (`websocket.<method>`), pasa
  por la contabilidad de concurrencia del servidor y se parsea aparte. Cincuenta logs eran cincuenta
  spans.

- **De `ERROR` para arriba no se espera** (`inmediatoDesde`, configurable). El log que más falta hace es
  el que precede a una caída, y era justo el que se quedaba en el buffer. Va en un buffer aparte, así que
  sale **sin arrastrar a los que estaban esperando**: pueden desordenarse entre sí y da igual, porque los
  listados ordenan por `@timestamp`, que lo pone quien escribe el log.

  «Inmediato» es *en el siguiente turno del bucle*, no síncrono, y es a propósito: el envío ya era
  asíncrono —va encadenado—, así que volcar síncronamente no adelantaría ni un `ws.send()` ni salvaría a
  un proceso que se muere en ese tick; y así una tormenta de errores en el mismo tick sale en **un**
  frame en vez de uno por error. Medido contra un servidor real: 21 errores en un frame a los 6 ms,
  mientras un `info` anterior salía a los 800.

- `cerrar()` **vuelca los dos buffers** antes de soltar el pool. Es la contrapartida obligatoria de agrupar: un
  apagado ordenado no pierde nada, y solo un `SIGKILL` se lleva hasta un segundo de logs. Con `lote: 1`
  se desactiva la agrupación para quien no quiera pagar ese riesgo.

- **`tsconfig.browser.json`**, y va el primero en el script `test`: typechequea `interface.ts` y
  `logger.ts` con `lib: ["esnext","dom"]` y `types: []`. Comprobado que falla de verdad metiendo un
  `import` de `node:os` en `logger.ts`.

### Fixed

- **El temporizador ya no se tipa como `NodeJS.Timeout`**, que no existe en el navegador: sale de
  `ReturnType<typeof setTimeout>`, y el `unref()` —que tampoco existe allí— va con `?.`.

  Era la punta de algo más grande, y conviene que quede dicho: **`destino/websocket.ts` no puede correr
  en el navegador de todos modos**. `WSPool` arrastra `dd-trace`, `node:crypto` y
  `services-comun/modules/utiles/log`, que importa `node:os` y `node:cluster`. Lo que sí es utilizable
  desde el navegador es el `Logger` y el vocabulario; un destino para allí tendría que hablar el mismo
  protocolo sobre el `WebSocket` nativo, sin pool.

### Changed

- El temporizador del buffer se crea con `unref()` donde existe: un buffer a medias no puede ser motivo
  para que un cronjob no termine.

---

## 2026.9.8 16:20 — [Jose]

### Added

- **Nace el paquete.** Su oficio es recoger los logs de un servicio y repartirlos entre destinos:
  consola, Datadog o la ingesta remota. De los tres, en esta primera vuelta solo está el último.

- **`Logger`** (`@mr/core-log/logger`): completa cada log con proyecto, servicio, severidad y
  timestamp, y lo pasa a sus destinos. No sabe a dónde va nada.

- **`IDestino`** (`@mr/core-log/interface`): el contrato de un destino. `enviar()` devuelve `void` y no
  puede lanzar — un log es un efecto secundario de lo que el servicio esté haciendo de verdad, y un
  destino caído no puede ni tumbar ni frenar a quien escribe.

- **`DestinoWebSocket`** (`@mr/core-log/destino/websocket`): envía a la ingesta de `status-external`
  por el método `/logs/service/`, con `WSPool.head()`. Fire-and-forget de principio a fin: no hay acuse
  de recibo.

- **El `socket` se pasa sin ruta y el destino le añade `/status/external/`** (configurable con `ruta`).
  Es lo que enruta: varios servicios comparten `status.meteored.com` y la ruta es lo único que mira el
  VirtualService de Istio; sin ella el upgrade se lo queda el servicio por defecto, `status-frontend`, y
  los logs dejan de llegar sin que nada falle a la vista. Necesitó arreglar antes la normalización de
  `WSPool`, que no admitía rutas — ver el `CHANGELOG` de `@mr/core-network`.

- **`ESeveridad`** como enum numérico, y la serialización a cadena dentro del destino. En el índice la
  severidad está guardada como cadena y quien la lee hace `Number.parseInt(severidad, 10) || 0`, así que
  una severidad mandada como `"error"` aparecería en el panel como informativa sin que nada fallara.
  Quien loguea no debería poder equivocarse en eso.

- **Aviso de fallo por consola y con cuentagotas** (`avisoMs`, un minuto por defecto). Por consola
  porque avisar con el propio logger sería alimentar el bucle. Con cuentagotas porque el fallo típico no
  es un log suelto sino la ingesta caída.

- **`spec/logger.spec.ts`**: 7 pruebas con `node:test`, mismo arnés que `framework/services-comun` y
  `@mr/core-i18n`. Cubren el `Logger`; el destino no, porque importa `@mr/core-network` y los `exports`
  del monorepo apuntan a `.ts`, que no se cargan en runtime sin bundler. Ver el CODEMAP.

- **Los envíos se encadenan, para que haya una sola conexión.** El pool reparte una conexión por
  petición en vuelo y crea las que le falten, así que lanzar los `head()` a la vez abría un socket por
  log: **53 conexiones para 53 logs**, medido contra un servidor real; con la cola, 1. Bajar
  `minConnections` no bastaba —solo dice cuántas hay calientes de antemano—, y de propina los logs salen
  ahora en el orden en que se escribieron. La cola tiene tope (`pendientes`, 1000): con el destino caído
  se descarta lo que sobre antes que comerse la memoria.

- **`IWire` es la declaración única del contrato del cable**, y `services/status-external` la importa de
  aquí (su `ILogServicioPOST` queda como alias). En esta dirección y no en la contraria porque el emisor
  no puede importar del receptor: `@mr/core-*` lo tienen todos los proyectos y `services-comun-status`
  no.

### Pendiente

- Destinos de consola y Datadog; hoy eso sigue en `services-comun/modules/utiles/log`, al que este
  paquete **no** sustituye todavía.
- Un destino para el navegador, sobre el `WebSocket` nativo.
