# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.11.20 09:40 — [Jose]

### Fixed
- **Un Job `Indexed` sin `POD_JOB` ya no hace de cada índice un Job y un CronJob distintos.** El hostname de un pod Indexed es `<job>-<índice>` y no casa con `-[a-z0-9]{5}$`, así que `leerEntornoCron()` lo usaba entero. Ahora, con `indice !== null` y un hostname que termina en `-<índice>`, el Job es el hostname sin ese sufijo (`jobDeHostname()`), y el CronJob, que se deduce de ese Job cuando falta `CRON_NOMBRE`, sale igual para todos los índices. Sin `indice`, todo igual que antes; `POD_JOB` sigue mandando. Pruebas en `spec/carga.spec.ts`, vistas fallar. README y CODEMAP.

## 2026.11.20 09:09 — [Jose]

### Added
- **El latido de un Job `Indexed` lleva su índice.** `IHeartbeatEjecucion.indice?: number|null`, leído de `JOB_COMPLETION_INDEX` (lo inyecta Kubernetes) por `leerEntornoCron()`/`construirEjecucion()` en `heartbeat/carga.ts`: solo vale un entero decimal de 0 a 65535 sin signo ni decimales; vacío, `abc`, `-1`, `3.5` o `70000` dan `null`. Opcional en el contrato (`IHeartbeat` v1 sigue igual): un emisor anterior no lo manda y un receptor anterior ignora el campo, así que no hay orden de despliegue obligatorio, pero un receptor sin soporte pierde el índice. No cambia cómo se identifica el Job (`POD_JOB`, o el hostname sin su último trozo).
- Pruebas: `spec/carga.spec.ts` (`"3"`, `""`, `"abc"`, `"-1"`, `"3.5"`, `"70000"`, ausente, y que `POD_JOB` sigue mandando) y `spec/payload.spec.ts` (el contexto y el heartbeat lo llevan); vistas fallar quitando la cota de 65535, la lectura de la variable y el paso a la ejecución.

## 2026.11.20 00:27 — [Jose]

### Fixed
- **Una carga finita que recibe la señal y se despide sin resultado también consta como `cortada`.** `ejecutarDespedida()` forzaba `causaDrenado: senal` solo si `despedir()` recibía `ejecucion`; la despedida desde `antesDeSalir` (sin argumento) mandaba un `parado` sin resultado ni causa, que el receptor guarda como `sin-despedida`. Ahora la condición es `finita && senal`. Con prueba, vista fallar.

### Changed
- **Corrección a la entrada de las 16:12:** «sin `HEARTBEAT` no se hace nada nuevo» no vale para cargas finitas (`cronjob`/`job` por manifest), que reciben estos cambios aunque el heartbeat esté apagado:
  - Un fallo cargando la configuración (o cualquier error antes de ejecutar) ya no deja el pod en `Running` con el sidecar vivo: se para el sidecar (`pararSidecarSiFinita()`) y sale con 1, así que el Job reintenta hasta su `backoffLimit` (hasta 7 pods por ocurrencia con el de por defecto, si el fallo es permanente).
  - El final normal sale con `process.exit(0)` explícito.
  - La rama cronjob del `catch` respeta `pod.sidecar` antes de pedir `/quitquitquit`, y la parada del sidecar tiene un tope de 2 s (`engine/sidecar.ts`).

## 2026.11.19 17:40 — [Jose]

### Fixed

- **El primer latido de un arranque fallido llegaba 0 de cada 27 veces.** `Heartbeat.esperarPrimerEnvio(maxMs)` resolvía en cuanto `head()` resolvía, es decir tras `ws.send()` (que solo encola el frame), y el `process.exit(1)` de `Main.ejecutar` llegaba en el mismo encadenado: el frame no salía. Ahora, tras el envío, espera a `pool.vaciar({timeoutMs: lo que quede})` (`bufferedAmount === 0`, ya existente en `WSPool`), siempre dentro del tope total de `PRIMER_ENVIO_ESPERA_MAX_MS` (1 s, handshake incluido) y sin cambiar el código de salida. Medido ejecutando `Main` con un sidecar y un receptor falsos: fallo de `load()` a 0, 2 y 5 ms con handshake del receptor de 0, 150 y 400 ms, 3 corridas cada caso: 0 de 27 frames `arrancando` antes, 27 de 27 después. No se toca `@mr/core-network`.
- **Un CronJob cortado por `activeDeadlineSeconds` que atendía el aviso constaba como `ok`.** Llegaba la señal, `solicitarApagado()` abortaba, `ejecutar()` resolvía y la despedida decía `ok` con `causaDrenado` `senal`: Kubernetes lo daba por Failed y el panel por bueno. Ahora, si hubo señal durante la ejecución (`alIniciarCierre`), `Heartbeat.despedir(ejecucion)` manda el `parado` con `ejecucion.resultado` `null`, `ejecucion.error` `null` y `causaDrenado` `senal` (forzada, el ciclo que la evaluaría puede no haber corrido), y el receptor lo guarda como `cortada`. También cuando `ejecutar()` falla después del aviso: `cortada` gana a `error` (el nombre del error queda en el `info` del pod). Contrato `IHeartbeat` v1 sin cambios (`resultado: null` ya era válido), así que no hay orden de despliegue obligatorio; sin señal, todo igual. Medido con el mismo arnés (CronJob en producción simulada, `SIGTERM` a mitad de ejecución): `parado` con `resultado` `ok` antes, `null` con causa `senal` después, tanto con `ejecutar()` correcto como con error; sin señal sigue `ok`/`error`.

### Added

- Pruebas: 2 en `spec/emisor.spec.ts` (vaciado tras el envío con lo que quede del tope, y vaciado que no acaba no pasa del tope) y 3 en `spec/emisor-finita.spec.ts` (señal con ok, señal con error, sin señal), todas vistas fallar al romper el código.

## 2026.11.19 16:33 — [Jose]

### Fixed

- **Un cronjob o job que falla antes de declararse como tal ya para el sidecar.** Si fallaba cargando la configuración o esperando al sidecar, salía por el camino de servicio con `exit(1)` sin `quitquitquit`: `istio-proxy` seguía vivo, el pod quedaba en `Running` y el Job colgado (con `Forbid`, saltándose las siguientes ejecuciones) hasta `activeDeadlineSeconds`. Ahora `Main.pararSidecarSiFinita()` lo para antes del `exit(1)` (que se mantiene, para que el Job reintente), solo en el proceso del pod; que la carga es finita lo dice el manifiesto que ya lee `crearPodInfo()` al empezar.
- **La parada del sidecar tiene tope.** `stopSidecar` usa `pararSidecar()` (`engine/sidecar.ts`, nuevo): espera la respuesta de `POST /quitquitquit` como mucho `PARADA_SIDECAR_MAX_MS` (2 s); antes, un proxy que aceptara la conexión sin contestar dejaba el proceso sin salir.

### Added

- `spec/sidecar.spec.ts`: respuesta, proxy que no contesta (vuelve al tope) y conexión rechazada; vista fallar quitando el tope.

## 2026.11.19 16:12 — [Jose]

### Changed

- **El heartbeat arranca antes en `Main`.** `start()` lee `crearPodInfo()` e `iniciarHeartbeat()` justo antes de `configLoader.load()` y del sidecar (antes, después de ambos y de borrar el lock), en servicio y en carga finita. Un proceso que muere cargando la configuración o esperando al sidecar ya deja su `arrancando`. Sin `HEARTBEAT` no se hace nada nuevo; el modo simple/primario/worker y la despedida finita (despedida → sidecar → `exit(0)`) no cambian.
- **Un arranque fallido espera al primer envío.** En el `catch` de `Main.ejecutar`, un servicio espera como mucho 1 s (`PRIMER_ENVIO_ESPERA_MAX_MS`) a que salga el primer latido antes de `exit(1)`; mismo código de salida y sin `parado`.

### Added

- `Heartbeat.esperarPrimerEnvio(maxMs)` y `esperarPrimerEnvio(emisor|null, maxMs)` (`heartbeat/finita.ts`, nunca rechaza).
- Pruebas en `emisor.spec.ts` y `finita.spec.ts`, vistas fallar al romper el código.

## 2026.11.19 13:57 — [Jose]

### Added

- **Emisor del heartbeat de cronjobs y jobs.** `decidirHeartbeat` habilita `tipo` `cronjob` y `job` (además de `service`) con `target` `k8s` y `HEARTBEAT=true`; las cargas finitas solo en modo simple (nuevo `modo?` en la entrada; `iniciarHeartbeat` lo pasa). El latido de un servicio sale idéntico.
- `heartbeat/carga.ts` (puro): `cargaDePod`, `esCargaFinita`, `leerEntornoCron` (`CRON_NOMBRE`, `CRON_SCHEDULE`, `CRON_TIMEZONE`, `CRON_CONCURRENCIA`, `CRON_PLAZO_INICIO_S`, `CRON_PLAZO_EJECUCION_S`, `POD_JOB`, `POD_JOB_UID`; todo puede faltar, recorta a los máximos del contrato, el job cae al hostname sin su último trozo), `horaProgramadaDeJob` (la hora del nombre `<cronjob>-<minutos>` solo si es coherente con el arranque y los plazos; un `job` nunca la tiene) y `construirEjecucion`.
- `heartbeat/finita.ts`: `terminarEjecucionFinita` (despedida → parada del sidecar → `exit(0)`) y `resultadoDeError` (solo `err.name`).
- `Sonda({finita})`: `listo` («en curso») en cuanto hay engine, sin `started()`/`ready()`. `Heartbeat({finita, presupuestoDespedidaFinitaMs})` y `despedir({resultado, error})`: el `parado` lleva el resultado en `ejecucion`; una carga finita que se despide por su cuenta espera al contexto hasta `PRESUPUESTO_DESPEDIDA_FINITA_MS` (3 s en total, 900 ms de ellos para el envío) en vez de abandonar si los metadatos de GKE aún no han llegado.

### Changed

- `construirContexto` acepta `carga`: en una carga finita la `revision` va vacía (antes habría tomado la hora programada del nombre del Job por un `pod-template-hash`) y el contexto lleva `carga` y `ejecucion`.
- `Main`: en una carga finita, `setEngine` antes de `master()`; el final (camino normal y el `catch` de `Main.ejecutar`) pasa por `terminarEjecucionFinita`, con `ok` o `error` (un fallo de `master()` cuenta como error aunque se siga ejecutando). El código de salida sigue siendo 0. Sin heartbeat, todo igual que antes (sidecar y salida); el camino del `catch` respeta ahora `pod.sidecar` al parar el sidecar y deja el `info` «Proceso terminado».
- `atenderSenal`: con una ejecución finita en marcha en producción avisa antes al heartbeat (`drenando`, causa `senal`), para que el receptor sepa que fue cortado si Kubernetes lo mata después.
- Pruebas: `carga.spec.ts`, `finita.spec.ts`, `emisor-finita.spec.ts` nuevas y ampliadas `config`, `payload`, `sonda` y `apagado`; todas vistas fallar al romper cada pieza.

## 2026.11.19 13:42 — [Jose]

### Added

- **Contrato del heartbeat para cargas finitas (cronjob y job), solo tipos** (`heartbeat/interface.ts`). `IHeartbeat` gana `carga?: TCargaPod` (`service` | `cronjob` | `job`; ausente es `service`: ningún emisor actual cambia) y `ejecucion?: IHeartbeatEjecucion` (el Job, su UID, el CronJob, la hora programada, la programación desplegada, la zona, la concurrencia, los plazos y, en la despedida, el `resultado` ok/error con el `err.name`). `v` sigue en 1. Es lo que valida y guarda el receptor (`status-external`); el emisor lo rellenará en otra tarea. La cabecera autogenerada del fichero no se toca (se regenera al enviar el framework).

## 2026.11.18 13:52 — [Jose]

### Changed

- **Solo comentarios y documentación; sin cambios de comportamiento.** `despedida.ts`, `crear.ts` y el README/CODEMAP remiten ahora al arreglo de la avalancha de reconexiones, que vive en `@mr/core-network`: su servidor WebSocket reparte el `Shutdown` del apagado entre los clientes (~40/s, hasta 10 s, con 50 o más) y da jitter a la vida de cada conexión, y `WSPool` repone con retraso aleatorio (`refillJitterMs`), cuenta los handshakes en vuelo y no deja sockets abiertos tras `destroy()` (lo que `REQUEST_TIMEOUT_MS` de `crear.ts` documentaba como pendiente). Este paquete **no usa `refillJitterMs`** a propósito, para no depender de la versión nueva de core-network: versiones mezcladas compilan y funcionan.

## 2026.11.18 12:58 — [Jose]

### Changed

- **El motivo de una despedida (`parado`) sin confirmar distingue «no llegó a haber conexión» de «había conexión y no contestaron», y recoge los dos intentos.** `IPoolHeartbeat.get` admite un tercer parámetro `{alConectar}` que `adaptarPool` llama en cuanto `WSPool.get()` resuelve (hay conexión) y antes de esperar la respuesta; `intentar()` lo usa para el motivo del timeout: `sin respuesta en 300 ms (no llegó a haber conexión)` o `sin respuesta en 300 ms (había conexión desde los 0 ms)`. «Había conexión» no es «conectó»: con el pool del emisor puede ser un socket ya abierto que en realidad está muerto. `IInformeDespedida.motivo` pasa a ser `intento 1: …; intento 2: …` (antes solo el último). Sin cambios en tiempos, presupuestos ni lógica de reintento/reserva.
- **Documentación corregida con lo medido en producción el 2026-11-18** (README, `despedida.ts`): el intento 1 es «por el pool del emisor», que tras el `Shutdown` de un receptor suele ser ya un handshake nuevo y no una conexión caliente (5 de 6 fallos); el reintento abre otra conexión por el mismo Service, que cae en otra réplica solo si hay otra viva (en los fallos medidos solo quedaba la atascada y el intento 2 no funcionó ni una vez); el fallo medido es la saturación del receptor superviviente por la avalancha de reconexiones (340–575 conexiones en 2–3 s, atasco de 3–4 s) y ninguna variante de la despedida en 1 s lo arregla; `sin-confirmar` no implica perdido (el intento abandonado puede llegar si su handshake abre antes del `exit`).
- Pruebas: 4 nuevas en `spec/despedida.spec.ts` (motivo sin conexión, con conexión, mixto y por intento en fallos que no son timeout) y 1 en `spec/despedida-ws.spec.ts` (servidor real que acepta la conexión y no contesta), todas vistas fallar.

## 2026.11.18 12:00 — [Jose]

### Added

- **Despedida (`parado`) del heartbeat con acuse del receptor.** Fallo medido en producción el 2026-11-18: un pod de status-backend se quedó en `drenando` sin `parado`.
  Lo medido: `antesDeSalir` superó 1 s (`Los callbacks de antesDeSalir superaron el presupuesto de 1000 ms`) en el backend y en el receptor que se apagaba a la vez, y el `parado` no llegó.
  Lo más probable, **no observado**: la despedida esperaba, sin tope, a un ciclo con el `head()` atascado en una reconexión (que no apareciera «Heartbeat descartado» no lo descarta: `avisarDescarte` limita a un aviso por minuto).
  - `interface.ts`: `METODO_HEARTBEAT_CONFIRMADO` e `IConfirmacionHeartbeat {v: 1, resultado: "confirmado"|"reintentar"}`. Mismo `IHeartbeat` v1 y misma ruta; `METODO_HEARTBEAT` no cambia y sigue sin contestar.
  - `despedida.ts` (nuevo, puro): `despedirConfirmado()`. Intento 1 por el pool caliente (`get`, ≤ 300 ms); `ok:false` (receptor anterior) → `head(METODO_HEARTBEAT)` de reserva sin reintento; sin respuesta, caída o `reintentar` → **un único reintento** por un pool nuevo de un solo uso (otra conexión) con todo el presupuesto que quede menos `MARGEN_RESERVA_MS` (100 ms, para el `head` de reserva): no se parte en intentos cortos, porque cada uno pagaría el handshake entero (DNS + TCP + TLS + upgrade, ~300-600 ms tras Cloudflare) y lo abandonaría a medias. Presupuesto total de 900 ms, mismo `parado` en todos los intentos, `destroy()` siempre, nunca rechaza.
  - `pool.ts` (nuevo): `adaptarPool()`, con `IPoolHeartbeat.get` (distingue `ok:false` de los fallos de red). `crear.ts`: fábrica `abrirNuevo` (`reconnect: false`) y `requestTimeoutMs` de 1000 en los pools.
  - Pruebas: `spec/despedida.spec.ts` (16), `spec/despedida-ws.spec.ts` (3, con un servidor WebSocket escrito a mano y el `WSPool` real; `spec/stubs/dd-trace.ts` y su entrada en `instalar.ts`) y 3 nuevas en `spec/emisor.spec.ts`, todas vistas fallar.

### Changed

- **`Heartbeat.despedir()` espera a un envío en vuelo como mucho `ESPERA_VUELO_MAX_MS` (100 ms)** y manda el `parado` él mismo, no un ciclo: un ciclo atascado ya no se come el presupuesto de 1 s (regresión en `spec/emisor.spec.ts`: con el `head()` atascado, el `parado` sale en < 150 ms). Un ciclo que estaba en vuelo no manda nada después del `parado`. `IConfigEmisor` gana `abrirNuevo` (obligatoria), `presupuestoDespedidaMs`, `esperaVueloMs` y `reloj`. `IPoolHeartbeat` gana `get`.
- Nuevo log `info` si la despedida se confirma en el intento ≥ 2 y `warning` si no se confirma.
- Hay que **desplegar antes el receptor** (`status-external`) y enviar `@mr/core-workload` después: con un receptor anterior la despedida cae en el `head` de reserva (como antes, más un viaje de ida y vuelta).

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

