# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.11.16 17:35 — [Jose]

### Changed

- **El autosondeo de `/admin/ready` de los servicios Next se hace cada 5 s y `no-listo` se mide en tiempo.** Medido en local con `next start` (3 min por variante), atender el sondeo cada segundo era más de la mitad de la CPU de reposo del heartbeat. `AdaptadorNext.ready()` consulta de verdad cada `INTERVALO_AUTOSONDEO_MS` (5000, inyectable con `intervaloSondeoMs`) y entre sondeos devuelve el último resultado (las llamadas simultáneas comparten el sondeo en vuelo). Sustituye a `FALLOS_SEGUIDOS_NO_LISTO`/`fallosSeguidosNoListo`: ahora rechaza cuando lleva `PLAZO_NO_LISTO_MS` (10 000, inyectable con `plazoNoListoMs`) sin un sondeo bueno, el equivalente de `failureThreshold: 10` × `periodSeconds: 1` del kubelet. Reloj inyectable (`ahora`). `started()` no cambia (la `Sonda` deja de llamarlo tras el primer éxito), ni `drenando`, ni los plazos de cada consulta ni el margen frente a la `Sonda`. Pruebas en `spec/sonda-next.spec.ts` (193 en total). README (sección «Servicios Next») y CODEMAP actualizados.

## 2026.11.16 16:19 — [Jose]

### Fixed

- **El autosondeo de los servicios Next tolera fallos como el kubelet.** En producción `service-status-frontend` pasó a `no-listo` y volvió a `listo` con un solo autosondeo fallido (15:01:57 y 15:11:58), cuando el kubelet no lo habría sacado de los endpoints (`failureThreshold: 10`). `AdaptadorNext.ready()` solo rechaza tras `FALLOS_SEGUIDOS_NO_LISTO` (10, inyectable con `fallosSeguidosNoListo`) fallos seguidos; un éxito reinicia la cuenta. `drenando` y el paso de `arrancando` a `listo` no cambian. La consulta de `ready()` vence `MARGEN_SONDA_MS` (50 ms) antes que el `PromiseTimeout` de la `Sonda`, que no tiene histéresis propia. El autosondeo pide `/admin/ready` y `/admin/started` **sin barra final**: con `trailingSlash: false` la barra daba un `308` por sondeo y duplicaba las peticiones por segundo (la CPU en reposo de status-frontend pasó de ~0,02 a 0,04–0,06 núcleos); con `trailingSlash: true` se sigue el `308`. Cadencia, umbral y plazos no cambian. Pruebas en `spec/sonda-next.spec.ts`. README (sección «Servicios Next») actualizado.

## 2026.11.16 13:35 — [Jose]

### Added

- **Heartbeat de pods en los servicios Next.js** (`heartbeat/next/`, importable como `@mr/core-workload/heartbeat/next`). Un servicio Next no
  arranca con `Main` ni tiene `Engine`, así que no emitía. `iniciarHeartbeatNext()` se llama desde el `register()` de `instrumentation.ts`
  (una vez por proceso, en `next start` y en standalone, Next 15.5 y 16) y reutiliza el emisor tal cual (`iniciarHeartbeat` en modo
  `simple`, `Sonda`, `Heartbeat`, `MedidorMetricas`, `despedirAcotado`, `borrarLockApagado`); sin `HEARTBEAT=true` no instala nada.
  - `AdaptadorNext` (`sonda-next.ts`) hace de `Engine` para la `Sonda`: `started()` y `ready()` son un autosondeo de `/admin/started/` y
    `/admin/ready/` en `127.0.0.1:$PORT` (200–399 es bueno, como el kubelet; timeout de 900 ms; sin agente y `Connection: close`), y `vigilarLock()` borra un `shutdown.lock` anterior y hace un `stat` cada 500 ms (con `unref`) para `drenando(prestop)`.
  - `ServidorCierreNext` (`cierre-next.ts`, un `IServidorCierre`) atiende `SIGTERM`/`SIGINT` tras el manejador de Next (`drenando(senal)`),
    envuelve `process.exit` tras la señal y, en la primera llamada, hace la despedida (`parado`, tope de 1 s) y después el `exit` real con el
    mismo código (143 en Next 16, 0 en la 15.5); un temporizador con referencia evita que, con el bucle vacío, Node salga solo con 0. Si nadie más
    atiende la señal (`NEXT_MANUAL_SIG_HANDLE`), sale él con `128 + n`.
  - `iniciar-next.ts`: guarda en `globalThis[Symbol.for("@mr/core-workload/heartbeat-next")]`, trabajo en segundo plano sin bloquear el
    primer request y todo error convertido en `warning`.
  - Pruebas: `spec/cierre-next.spec.ts` (con un proceso falso y con un proceso hijo real que recibe `SIGTERM`), `spec/sonda-next.spec.ts` (con un
    servidor HTTP de verdad y la `Sonda` real) y `spec/iniciar-next.spec.ts`, todas vistas fallar rompiendo el código. Pruebas: 141 -> 182.
  - El autosondeo sigue las redirecciones como el kubelet (el `308` de `trailingSlash`): mismo host y puerto, hasta 10 saltos, 900 ms en total; otro host cuenta como `listo`.
  - Revisión: sin `HEARTBEAT=true` no se lee el pod (antes un workspace sin `mrpack.json` daba un `warning` en cada arranque), y fuera de producción el autosondeo tiene 5 s de plazo (`next dev` daba `no-listo` mientras compilaba; `IConfigIniciarHeartbeat.timeoutSondaMs`, opcional).
  - Solo de servidor: no importarlo desde código compartido con el navegador. README (sección «Servicios Next») y CODEMAP actualizados.

## 2026.11.16 13:16 — [Jose]

### Changed

- **Heartbeat en modo cluster: `metricas.rss` es la del primario más la de los workers vivos.** Antes era solo la del primario, así que
  la columna Memoria de `/infra/pods` quedaba muy por debajo de lo que consume el pod. El informe IPC que cada worker ya mandaba al
  primario (cada segundo y en cada cambio) lleva ahora `rss` (`process.memoryUsage.rss()`, opcional en `IMensajeHeartbeatWorker`):
  ni mensaje ni temporizador nuevos, solo un número más en un mensaje que ya existía (unos 1 por segundo y worker). `RegistroWorkers.rss()`
  suma los workers vivos que han informado hace no más de 3 s (el mismo criterio de caducidad que el estado agregado) y mandaron `rss`;
  un worker muerto, parado, caducado, recién dado de alta o de una versión anterior (sin `rss`) no suma, y un `rss` inválido (NaN,
  negativo) se ignora. `metricasConWorkers()` lo aplica en `crear.ts`; el pod simple no cambia. El contrato (`metricas.rss` en bytes)
  y el receptor no cambian; solo el JSDoc de `IHeartbeatMetricas.rss`. Pruebas nuevas en `spec/rss-workers.spec.ts` y una en
  `spec/sonda.spec.ts`, todas vistas fallar rompiendo el código. Pruebas: 132 -> 141.

## 2026.11.13 09:09 — [Jose]

### Fixed

- **Heartbeat en modo simple: ya no se pierde la transición `null → arrancando`.** El emisor manda una foto del estado en cada
  ciclo, y `arrancando` (`tseq` 0) solo se repetía mientras durase. Un pod que estaba listo antes de su primer envío, o cuyo primer
  envío se descartaba, mandaba directamente `tseq` 1, y el receptor ya no acepta un `tseq` menor que el que conoce. En status-backend
  en modo simple el engine está listo en menos de 1 s y salía siempre `arrancando → listo` sin el `null → arrancando`; en modo cluster
  sí salía, porque el primario se queda 17 s en `arrancando`. Ahora `Heartbeat` (`heartbeat/emisor.ts`), mientras no haya entregado
  ningún mensaje y durante `PRIMER_ESTADO_MAX_MS` (25 s, por debajo de los 30 s de primera vista del receptor), manda antes de la
  primera transición la foto de `arrancando` con `tseq` 0 y el `desde` de cuando se creó. Si esa no se entrega, no manda la actual,
  que sale en el siguiente ciclo. La despedida no espera por esto. Cuatro pruebas nuevas en `spec/emisor.spec.ts`; las que lo
  cubren, vistas fallar sin el arreglo. Una prueba de la despedida ahora espera `arrancando, listo, parado`. Pruebas: 128 -> 132.

## 2026.11.13 08:59 — [Jose]

### Fixed

- **Heartbeat en modo cluster: el pod ya no vuelve de `no-listo` a `arrancando` al arrancar.** El primario da de alta cada worker
  como `arrancando`, pero si no informaba en 3 s (`TIMEOUT_WORKER_MS`) lo contaba como `no-listo`, y cuando el worker por fin
  informaba, el pod volvía a `arrancando`. En status-backend con dos workers se midió `arrancando → no-listo → arrancando → no-listo
  → listo`: los workers tardaron 17 s en cargar y arrancar el heartbeat. Ahora un worker que todavía no ha informado nunca
  (`IEstadoWorker.informado: false`, lo pone `RegistroWorkers.alta()`) no caduca y sigue `arrancando`; si no llega a arrancar, lo
  mata la `startupProbe`. Uno que ya ha informado y se calla sigue contando como `no-listo` a los 3 s. Dos pruebas nuevas en
  `spec/estado.spec.ts`, vistas fallar sin el arreglo. Pruebas: 126 -> 128.

## 2026.11.12 17:30 — [Jose]

### Fixed

- **El pod ya no sale de los endpoints con el servidor cerrado, ni deja procesos sin apagar, desde que `SIGTERM` llega a Node** (el `run.sh`
  arranca con `exec node <yarnPath>`). En los proyectos cuyo preStop solo escribe `shutdown.lock` (sin `sleep 3`), el servidor cerraba antes
  de salir de los endpoints (503), `Engine.shutdown()` no se esperaba, los procesos sin HTTP morían al instante, el primario de un cluster
  sin heartbeat moría dejando workers y un `shutdownTimeout` de usuario de 25 s superaba la gracia.

### Added

- **Margen de endpoints** (`engine/lock.ts`): `MARGEN_ENDPOINTS_MS` (3 s), `calcularMargenPendiente()` y `margenPendienteMs()`: al recibir
  `SIGTERM` se espera lo que falte de 3 s desde la fecha de `shutdown.lock` (con `sleep 3` en el preStop, ~0; sin él, ~3 s; sin lock en
  producción, 3 s; fuera de producción, 0) con el servidor aún atendiendo.
- `Engine.solicitarApagado(motivo)` (aborta y ejecuta `shutdown()` **una sola vez**, nunca rechaza), `Engine.apagadoPorServidor` y `shutdown()` en
  la clase base (hook con `override`). El watcher del lock, el cierre del servidor y la señal pasan por él. `ApagadoUnico` (`engine/apagado-unico.ts`).
- `engine/apagado.ts`: `atenderSenal()` / `instalarApagado()`. `Main` instala un manejador único de `SIGTERM`/`SIGINT` en modo simple y en
  workers: delega en el servidor HTTP si éste atiende señales; en un proceso sin HTTP pide el apagado con tope 18 s (2 s en desarrollo), se
  despide (≤ 1 s) y sale con 0; en un cronjob/job con `ejecutar()` en marcha pide el apagado y **no sale** (acaba `ejecutar()`); una segunda
  señal sale ya con `128 + n`.
- `despedirAcotado()` en `heartbeat/cierre-primario.ts`.
- Tras la revisión: **en desarrollo un cronjob/job sale tras la señal** (`shutdown()` con tope de 2 s y `128 + n`; `node --watch` espera sin tope y no
  se reiniciaba), en producción se mantiene «no sale». **El primario de cluster sale ya con `128 + n` ante una segunda señal.** `ejecucionFinitaPendiente`
  se pone justo tras el `build` (una señal durante `master()` de un cronjob salía con 0 y el Job constaba como correcto). Sin lock en
  producción ya no sale el aviso espurio de «antesDeCerrar superaron el presupuesto» (`esperaMargenMs`, `HOLGURA_PRESUPUESTO_MS`). `Main` no
  repite en el log la señal que ya escribe el servidor. `instalarApagado` e `instalarCierrePrimario` devuelven el desinstalador.

### Changed

- **El primario de un cluster atiende la señal con o sin heartbeat** (`emisor: IEmisorCierre|null`): reenvía la señal, espera
  `margen + ESPERA_WORKERS_MS` y sale; la despedida y el `drenando` solo con heartbeat. `ESPERA_WORKERS_MS` se deriva de
  `SHUTDOWN_TIMEOUT_PRODUCCION_MS` y `PRESUPUESTO_ANTES_DE_SALIR_MS` de `@mr/core-network`.
- `/admin/ready/` responde 503 también si `preStopSolicitado` (ha aparecido `shutdown.lock`), no solo durante el cierre del servidor.
- El `shutdown()` del Engine HTTP pasa a `protected override`; su contrato: se espera, con presupuesto. **Las subclases directas de `Engine` que
  sobreescriban `shutdown()` necesitan `override`** (`noImplicitOverride`).
- Pruebas: 95 -> 126 (`engine-apagado`, `apagado`, `presupuesto`, margen en `lock`, sin emisor y con margen en `cierre-primario`). El arnés mapea
  `@mr/core-network/server/http/config/net` (solo constantes) al `.js` emitido y añade un stub de `fs`.

## 2026.11.12 14:32 — [Jose]

### Changed

- `ESPERA_WORKERS_MS`: 21 s -> **19 s**, por el `shutdownTimeout` de 18 s de `@mr/core-network` (ver su CHANGELOG): el peor caso del
  primario de un cluster pasa a 19 + 1 s de despedida + 3 s del preStop = 23 s, dentro de los 25 s de gracia.

## 2026.11.12 12:40 — [Jose]

### Fixed

- **`shutdown.lock` se borra una sola vez por pod, desde `Main`** (modo simple o primario, antes de forkear), no en el `init()` de cada worker. En cluster, un worker que arrancaba tarde se llevaba por delante un lock legítimo de un pod que ya estaba terminando y no drenaba. Elegido frente a «solo si el `mtime` es anterior al arranque del proceso» porque ese criterio no distingue un worker relanzado tras el lock (que borraría el legítimo); con `Main` solo hay un momento posible, anterior a que exista cualquier worker. `chokidar` ve el lock que aparezca después (`ignoreInitial` por defecto), así que no se pierde ninguno.
- **La despedida del primario tiene tope** (`DESPEDIDA_MAX_MS`, 1 s, `despedidaMs`): `despedir()` espera al contexto y reconecta (hasta unos 5 s), y con los 21 s de espera a los workers pasaba de los 25 s de gracia. Peor caso ahora: 21 s + 1 s.
- **`POD_REVISION` que el receptor descartaría** (más de 16 caracteres o fuera de `a-z0-9`): el receptor tiraba todos los latidos del pod y el pod no aparecía. `revisionDePod()` manda vacía y avisa (sin el valor) una sola vez por pod (`avisar`, que `construirContexto` y `crear.ts` encadenan).

## 2026.11.12 12:15 — [Jose]

### Added

- **`IHeartbeat.revision`**: el `pod-template-hash` del ReplicaSet (`POD_REVISION`, Downward API desde la etiqueta; si no llega, en
  producción el penúltimo trozo del hostname cuando tiene la forma `<deployment>-<hash>-<sufijo>`; vacío fuera del clúster). Cambia
  en cada rollout, también en los que solo cambian el yml y no la imagen. `revisionDePod()` en `heartbeat/payload.ts`.
- **Modo cluster**: con el heartbeat habilitado, el primario instala un manejador de `SIGTERM`/`SIGINT` (`heartbeat/cierre-primario.ts`)
  que marca `drenando`, reenvía la señal a los workers, espera a que salgan (hasta 21 s), manda `parado` y sale. Con el heartbeat
  apagado no cambia nada. `IHeartbeatCreado.emisor` (nuevo).
- Pruebas: `engine/lock`, metadatos con reintento, formato del token, avisos, `revision`, contexto que falla, cierre del primario,
  contexto pendiente en el emisor y memoria del drenado.

### Changed

- **Metadatos de GKE (`cluster`, `ubicacion`, `proyectoGcp`) en producción**: se reintentan con backoff (1, 2, 4… hasta 30 s) y **no se
  emite hasta tenerlos** (forman parte de la clave de la tabla del receptor; con un solo intento, un fallo los dejaba vacíos para
  siempre). Las `HEARTBEAT_*` siguen mandando y evitan la espera. Un `warning` una sola vez mientras falle y un `info` con los valores y
  su origen al resolverse. Fuera de producción, como antes. `leerMetadatos` acepta `reintentar`, `esperar`, `primeraEsperaMs` y
  `maxEsperaMs`. La despedida no espera al contexto.
- **`HEARTBEAT_TOKEN` en producción** tiene que tener la forma `hb1.<id>.<secreto>` que espera el receptor; si no, no se emite y se avisa
  (sin el valor).
- El aviso de `ENTORNO` incoherente solo sale si el heartbeat está habilitado (antes salía también en cronjobs).
- Si falla la construcción del contexto, un `warning` (antes, silencio) y no se emite.
- El aviso de heartbeat descartado nombra las dos causas probables (fallo de red o 401): `WSPool` no las distingue.
- El agregado de un pod en cluster sigue `drenando` si, después de drenar, no quedan workers (antes volvía a `arrancando`).

### Fixed

- `shutdown.lock` sobrevivía a un reinicio del contenedor (`emptyDir` del pod) y el contenedor nuevo se apagaba al arrancar: `init()` del
  Engine HTTP lo borra antes de vigilar la carpeta.
- Con `@mr/core-network` 2026.11.12 el cierre ya no espera al `shutdownTimeout` por un WebSocket entrante abierto, así que `antesDeSalir`
  (el `parado` del heartbeat) llega a ejecutarse antes del SIGKILL.

## 2026.11.12 11:13 — [Jose]

### Added

- **Heartbeat de pods** (`heartbeat/`): cada pod de un servicio (`deploy.type` `service`, `target` `k8s`, con `HEARTBEAT=true`; apagado por
  defecto) manda un heartbeat por WebSocket a `status-external` cada segundo y sin esperar respuesta (`WSPool.head()`), con estado
  (`arrancando`, `listo`, `no-listo`, `drenando`, `parado`), transiciones, métricas y los datos del pod (cluster, proyecto de GCP y ubicación
  salen del servidor de metadatos de GKE). `heartbeat/interface.ts` es la única declaración del mensaje (`IHeartbeat` v1). Un solo envío
  en vuelo, sin acumular; despedida `parado` en `Server.antesDeSalir`. Detalle y variables de entorno en el README.
- **Modo cluster**: un heartbeat por pod. Los workers informan a su primario por IPC (`cmd: "heartbeat"`) y el primario emite el agregado con
  `procesos: {total, listos}`. En cluster no hay `parado` (el primario no recibe señales propias).
- **Engine HTTP**: `ultimoReady`, `preStopSolicitado` y `registrarReady()`. `GET /admin/ready/` guarda su último resultado para que la sonda no
  repita `ready()`, que en algunos servicios consulta Elastic.
- **`IPodInfo.tipo` y `IPodInfo.target`** (del manifest), que solo construye `crearPodInfo()`.
- **Pruebas** (`spec/`, `node:test`; script `test`) y dependencias `@mr/core-log`, `typescript` (dev) y `tslib`.
- `HEARTBEAT_TOKEN` y `HEARTBEAT_SOCKET` se recortan: el token llega de un Secret montado desde un fichero, y con un salto de línea final
  el hash no coincidiría nunca y todos los pods se quedarían fuera con un 401.

## 2026.10.19 12:40 — [Alex]

### Added

- **`config/pubsub.ts`**: `comprobarEmuladorPubSub({produccion, env})` (la guarda que hasta ahora vivía en `amateur-base`,
  movida tal cual) y `modoPubSub(env)`, que devuelve `{emulador, proyecto}` a partir de `PUBSUB_EMULATOR_HOST` y
  `PUBSUB_PROJECT_ID` (`null` si faltan o están vacías).
- **`GET /admin/pubsub/`** (`handlers/admin.ts`): fuera de producción responde `data: {emulador, proyecto}`, para que los tests e2e
  comprueben que un servicio está levantado contra el emulador. En producción responde 404, como `debug-handoff`.

### Changed

- **Documentación de la guarda corregida** (sin cambios de código): el JSDoc de `comprobarEmuladorPubSub` decía que la variable la fijaban «los
  helpers de los tests de integración»; ahora la pone `mrpack devel -p` (los tests ya no levantan servicios).
- **`Main.start()` aborta el arranque si un bundle de test o producción tiene `PUBSUB_EMULATOR_HOST`** y, si el proceso corre contra el
  emulador, lo deja en el log (`Pub/Sub: emulador <host> (<proyecto>)`; solo el primario en modo cluster). Se hace en `start()` y no
  en `ejecutar()` para que el rechazo pase por el `catch` que ya registra el error y sale: con código 1 en un servicio y con 0 en un
  cronjob (tras parar el sidecar), como cualquier otro error de arranque; no se ha cambiado el código de salida de `ejecutar()`. Sin la
  variable no hace ni registra nada.

## 2026.9.29 08:15 — [David]

### Changed

- **`IPodInfo.buckets` conserva su tipo (`Record<string, string | string[]>`)** aunque el manifiesto admita
  `{buckets, basePath?}`: `crearPodInfo()` aplana esa forma con la nueva `aplanarBuckets()` (exportada) y deja
  solo los nombres. El prefijo va en el nuevo campo opcional `IPodInfo.bucketsBasePath` (clave → `basePath`,
  solo para las claves que lo definen), de modo que los consumidores existentes de `pod.buckets` no se rompen.


## 2026.9.23 09:25 — [Jose]

### Changed

- **Código adaptado a `yarn lint`** (`@mr/core-lint`), sin cambios de comportamiento: `import type` en los
  imports que solo traen tipos, llaves en todos los `if`/`else`/`for`/`while`, bloques de imports en su orden
  y separados por una línea en blanco, fuera las dobles líneas en blanco, `Tipo[]` en vez de `Array<Tipo>` y
  sin `/* STATIC */` en las clases que no tienen estáticos. Casi todo con el autofix; el orden de imports,
  con un codemod que solo movía líneas enteras.
- Variables en `snake_case` renombradas a `camelCase`.

## 2026.8.7 — [Jose]

### Changed

- **`engine/server.ts`** — soporte para el nuevo mecanismo de reenvío de peticiones
  `Upgrade:` HTTP/1.1 de `@mr/core-network` (ver su propio changelog):
  - El método privado `iniciar(handlers, config)` recoge ahora también los `IUpgradeHandler`
    (`getUpgradeHandlers()`) de cada `RouteGroup`, además de los `IWSHandler` de siempre. Su
    tipo de retorno cambia de `IWSHandler[]` a la interfaz interna `IHandlersAuxiliares
    {webSockets, upgrades}`.
  - `initWebServer`/`initWebServerS` pasan los descriptores de upgrade recogidos a
    `server.iniciarHTTP`/`iniciarHTTPs` (tercer parámetro, opcional, de `@mr/core-network`).
  - `iniciar()` emite un `warning` si un servicio declara handlers WebSocket y descriptores de
    upgrade a la vez: ambos mecanismos se enganchan al mismo evento nativo `'upgrade'` y ningún
    listener puede cancelar la emisión a los demás.

---

## 2026.8.5 — [Jose]

### Changed

- **`README.md`** — nueva sección "Configuracion base" (`@mr/core-workload/config`)
  documentando `cargar(defecto)` y el mecanismo de sobreescritura desde
  `files/config.json`: no es un fichero de configuración autocontenido, solo
  sobreescribe campo a campo los valores por defecto (`defecto`) que cada subclase
  define en su propio `load()`; puede omitirse o dejarse vacío.
- **`CODEMAP.md`** — nueva subsección `config/index.ts` con el detalle de
  `IConfiguracion`, `Configuracion<T>` y `cargar()`, incluyendo el mismo comportamiento
  de `files/config.json`.

---

## 2026.7.24 — [Jose]

### Added

- **`handlers/admin.ts`** — nueva ruta `POST /admin/debug-handoff/`: fuera de
  producción invoca `server.cederPuertoParaDebug()` (de `@mr/core-network/server/http/server`)
  para que la instancia normal en ejecución libere el puerto HTTP a favor de una sesión
  de depuración de PhpStorm; en producción responde `404`. Forma parte del mecanismo de
  handoff de puerto documentado en
  [`@mr/core-network/server/http/README.md`](../network/server/http/README.md#handoff-de-puerto-para-depuración-local-solo-produccion).

---

## 2026.6.17 — [Jose]

### Added

- **`config/google/`** *(nuevo)* — módulo de configuración de Google Cloud:
  - `config/google/storage.ts`: `IGoogleStorage<T>` + `GoogleStorage<T>` — configuración
    de credenciales y buckets de GCS con soporte de subdirectorios.
  - `config/google/index.ts`: `IGoogle<T>` + `Google<T>` — configuración completa de GCP
    (proyecto, cliente, location, storage).

- **`index.ts` → `IConfiguracionLoader`** *(nuevo)* — contrato de carga de configuración
  propio del paquete, desacoplado de `services-comun/modules/utiles/config`.
  Exige un método `load(): Promise<Configuracion>`. `Main` sobreescribe la propiedad
  tras la primera llamada para garantizar la carga single-shot.

### Changed

- **`engine/index.ts`** — JSDoc completo:
  - `TAbort`: descripción y propagación del motivo al `AbortSignal`.
  - `TEngineStatic` / `TEngineCtor`: propósito de los tipos helper de la factoría polimórfica.
  - `Engine<T>`: descripción del flujo `build → prebuild → construir → master/ejecutar`
    con diagrama ASCII.
  - `build()`: orden de pasos, polimorfismo por subclase.
  - `syncCredenciales()`: lógica de symlinks y condición de activación.
  - `prebuild()`: comportamiento no-op en la base y uso en subclases.
  - `construir()`: posibilidad de sobreescritura.
  - `abortSignal` getter: descripción de activación.
  - `abort()`: propagación del motivo.
  - `master()` / `ejecutar()`: punto de entrada y delegación al hook.
  - `initMaster()` / `init()`: semántica no-op y obligación de sobreescritura.
  - `usoMemoria()` / `usoTiempo()`: campos que imprime en el log.

- **`engine/server.ts`** — JSDoc completo:
  - `IConfig`: descripción de cada propiedad con valores por defecto.
  - `Engine<T>` (abstracto): descripción de responsabilidades, ejemplo de uso.
  - `prebuild()`: lógica de resolución `service`/`pod` en producción vs. desarrollo.
  - `handlers` / `routes`: propósito y cuándo están disponibles.
  - `init()`: descripción del watcher de `chokidar` y trigger `shutdown.lock`.
  - `iniciar()`: orden de pasos (i18n, Admin, Favicon, caché, WS handlers).
  - `initWebServer()` / `initWebServerS()`: diferencias HTTP vs. HTTPS fire-and-forget.
  - `started()` / `ready()` / `okAll()`: semántica de probe y ruta asociada.
  - `ok()`: hook genérico personalizable.
  - `shutdown()`: trigger y casos de uso típicos.

- **`config/index.ts`** — JSDoc completo en `IConfiguracion`, `Configuracion<T>` y `cargar()`.

- **`config/pod.ts`** — JSDoc completo en `IPodInfo` (13 campos) y `crearPodInfo()`.

- **`config/net.ts`** — JSDoc ya existente, sin cambios adicionales.

- **`config/google/storage.ts`** — JSDoc completo en `IGoogleStorage<T>` y `GoogleStorage<T>`.

- **`config/google/index.ts`** — JSDoc completo en `IGoogle<T>` y `Google<T>`.

- **`index.ts` → `Main.ejecutar`** — el parámetro `configLoader` ahora tipifica contra
  el nuevo `IConfiguracionLoader` local en lugar del de `services-comun`. Esto resuelve
  el error `TS2345` que surgía cuando la clase `Configuracion` del servicio extiende
  `ConfigGenerico` con miembro `protected defecto`, impidiendo compatibilidad estructural
  entre jerarquías de herencia distintas.
  Los servicios que pasen su clase de configuración deben añadir el cast mínimo:
  ```ts
  type TConfigLoader = Parameters<typeof Main.ejecutar>[1];
  Main.ejecutar(Engine, Configuracion as TConfigLoader);
  ```

- **`index.ts`** — JSDoc completo en `IEngine`, `IConfiguracionLoader`, `IMainConfig`,
  `Main`, `Main.ejecutar`, `stopSidecar`, `startSidecar` y `start`.

- **`CODEMAP.md`** — árbol y superficie pública ampliados con detalle completo de
  `engine/index.ts` y `engine/server.ts`.

---

## 2026.6.16 — [Jose]

### Added

- **`config/google/`** *(nuevo)* — módulo de configuración de Google Cloud:
  - `config/google/storage.ts`: `IGoogleStorage<T>` + `GoogleStorage<T>` — configuración
    de credenciales y buckets de GCS con soporte de subdirectorios.
  - `config/google/index.ts`: `IGoogle<T>` + `Google<T>` — configuración completa de GCP
    (proyecto, cliente, location, storage).

- **`index.ts` → `IConfiguracionLoader`** *(nuevo)* — contrato de carga de configuración
  propio del paquete, desacoplado de `services-comun/modules/utiles/config`.
  Exige un método `load(): Promise<Configuracion>`. `Main` sobreescribe la propiedad
  tras la primera llamada para garantizar la carga single-shot.

### Changed

- **`config/index.ts`** — JSDoc completo en `IConfiguracion`, `Configuracion<T>` y el
  método estático `cargar()`.

- **`config/pod.ts`** — JSDoc completo en `IPodInfo` (con descripción de cada campo) y
  en `crearPodInfo()` (lógica de resolución de host, sidecar, replica, wire y deploy).

- **`config/net.ts`** — JSDoc ya existente revisado (sin cambios adicionales en esta versión).

- **`config/google/storage.ts`** — JSDoc completo en `IGoogleStorage<T>` y `GoogleStorage<T>`.

- **`config/google/index.ts`** — JSDoc completo en `IGoogle<T>` y `Google<T>`.

- **`index.ts` → `Main.ejecutar`** — el parámetro `configLoader` ahora tipifica contra
  el nuevo `IConfiguracionLoader` local en lugar del de `services-comun`. Esto resuelve
  el error `TS2345` que surgía cuando la clase `Configuracion` del servicio extiende
  `ConfigGenerico` con miembro `protected defecto`, impidiendo compatibilidad estructural
  entre jerarquías de herencia distintas.
  Los servicios que pasen su clase de configuración deben añadir el cast mínimo:
  ```ts
  type TConfigLoader = Parameters<typeof Main.ejecutar>[1];
  Main.ejecutar(Engine, Configuracion as TConfigLoader);
  ```

- **`index.ts`** — JSDoc completo en todos los tipos y métodos exportados:
  `IEngine`, `IConfiguracionLoader`, `IMainConfig`, `Main`, `Main.ejecutar`,
  `stopSidecar`, `startSidecar` y `start`.

- **`CODEMAP.md`** — árbol y superficie pública ampliados con `config/google/`, `config/pod.ts`
  y detalle completo de `config/index.ts`.

---

## 2026.6.16 — [Jose]

### Added

- **`engine/server.ts`** *(nuevo)* — `Engine` HTTP abstracto que extiende `Engine` base.
  Proporciona `initWebServer` / `initWebServerS`, watcher de shutdown via `chokidar` y
  el hook estático `prebuild` que configura `Respuesta.setContextoDefecto(...)` con
  los metadatos del pod (service, pod, version, zona).
  Exporta `IConfig` con las opciones opcionales `error`, `idiomas` y `cache`.

- **`handlers/admin.ts`** *(trasladado desde `@mr/core-network/server/http/handlers/admin`)* —
  handler de rutas de administración interna (`/admin/started/`, `/admin/ready/`,
  `/admin/live/`, `/admin/check/`, `/admin/doc/`, `/admin/metrics/`).
  Añade el endpoint `/admin/metrics/` en formato Prometheus respecto a la versión anterior.

- **`handlers/error.ts`** *(trasladado desde `@mr/core-network/server/http/handlers/error`)* —
  handler de error HTTP por defecto (`RouteGroupError`). En producción omite `extra`
  de la respuesta JSON para evitar filtrar información interna.

- **`handlers/favicon.ts`** *(trasladado desde `@mr/core-network/server/http/handlers/favicon`)* —
  handler para `GET /favicon.ico`. Sirve `assets/favicon.ico` con caché de 1 mes;
  devuelve `404 no-cache` si el fichero no existe.

  > Los tres handlers se mueven aquí porque `Admin` y `ErrorHandler` dependen de
  > `Engine` (de este mismo paquete), evitando así la dependencia circular que existiría
  > si permanecieran en `@mr/core-network`.
  >
  > Actualizar imports:
  > ```ts
  > import Admin   from "@mr/core-workload/handlers/admin";
  > import ErrorH  from "@mr/core-workload/handlers/error";
  > import Favicon from "@mr/core-workload/handlers/favicon";
  > ```

