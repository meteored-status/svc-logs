# `@mr/core-workload`

Paquete de orquestación y ciclo de vida de las cargas de trabajo del monorepo.

Proporciona el `Main` de arranque, el `Engine` base y el `Engine` HTTP abstracto,
junto con los handlers predefinidos (`admin`, `error`, `favicon`) que dependen del engine.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Main / IEngine / IConfiguracionLoader](#main--iengine) | `@mr/core-workload` | Orquestador de arranque, contrato de engine y contrato de loader |
| [Configuracion base](#configuracion-base) | `@mr/core-workload/config` | Configuración con metadatos de pod y sobreescritura opcional desde `files/config.json` |
| [ConfiguracionNet](#configuracionnet) | `@mr/core-workload/config/net` | Configuración base de servicio con red (`net`) |
| [Guarda de Pub/Sub](#guarda-de-pubsub) | `@mr/core-workload/config/pubsub` | `comprobarEmuladorPubSub` y `modoPubSub`: aborta el arranque si un bundle de test/producción apunta al emulador |
| [Engine base](#engine-base) | `@mr/core-workload/engine` | Clase base del engine: `build`, ciclo de vida, abort, métricas |
| [Engine HTTP](#engine-http) | `@mr/core-workload/engine/server` | Engine HTTP/HTTPS abstracto con watcher de shutdown |
| [Heartbeat de pods](#heartbeat) | `@mr/core-workload/heartbeat/interface` | Cada pod de un servicio manda su estado a `status-external` cada segundo; contrato del mensaje y emisor |
| [Heartbeat en servicios Next](#servicios-next) | `@mr/core-workload/heartbeat/next` | `iniciarHeartbeatNext()`: el mismo heartbeat en un servicio Next.js, desde `instrumentation.ts`, sin `Main` ni `Engine` |
| [Handler admin](#handler-admin) | `@mr/core-workload/handlers/admin` | Rutas de administración interna (`/admin/*`) |
| [Handler error](#handler-error) | `@mr/core-workload/handlers/error` | Handler de error por defecto (404 / JSON) |
| [Handler favicon](#handler-favicon) | `@mr/core-workload/handlers/favicon` | Sirve `/favicon.ico` |

---

## Main / IEngine

**Entrada:** `@mr/core-workload`

```ts
import {Main} from "@mr/core-workload";
import type {IEngine, IMainConfig} from "@mr/core-workload";
```

Punto de entrada del runtime. Gestiona la carga de configuración, el arranque del sidecar
Istio, el modo cluster y el ciclo completo de `build` → `master` → `ejecutar`.

```ts
// Arranque típico (main.ts de un servicio)
Main.ejecutar(MiEngine, MiConfiguracion);

// Con modo cluster (mínimo 2 threads)
Main.ejecutar(MiEngine, MiConfiguracion, {minimo_hilos: 2});
```

| Opción | Por defecto | Descripción |
|--------|:-----------:|-------------|
| `minimo_hilos` | `1` | `1` = modo simple; cualquier otro valor activa cluster. `< 1` = `os.availableParallelism()`. |

Lo primero que hace el arranque (`Main.start()`), antes incluso de cargar la configuración, es
[comprobar que no se esté apuntando al emulador de Pub/Sub](#guarda-de-pubsub) desde un bundle de test o producción;
si el proceso corre contra el emulador, lo deja en el log (`Pub/Sub: emulador <host> (<proyecto>)`).

---

## Guarda de Pub/Sub

**Entrada:** `@mr/core-workload/config/pubsub`

`@google-cloud/pubsub` cambia por sí sola a un canal inseguro contra `PUBSUB_EMULATOR_HOST` y descarta las credenciales de la cuenta de
servicio: en un servicio desplegado, perder los mensajes sin ninguna alarma. Por eso la variable solo se admite en desarrollo.

| Función | Descripción |
|---------|-------------|
| `comprobarEmuladorPubSub({produccion, env})` | Lanza si `produccion` (el `PRODUCCION` del bundle: `true` en test y producción) y `PUBSUB_EMULATOR_HOST` está definida. Una variable vacía cuenta como no definida. |
| `modoPubSub(env)` | `{emulador, proyecto}`: `PUBSUB_EMULATOR_HOST` y `PUBSUB_PROJECT_ID`, o `null` en la que esté ausente o vacía. Es lo que devuelve `GET /admin/pubsub/`. |

`Main.start()` llama a `comprobarEmuladorPubSub({produccion: PRODUCCION, env: process.env})` lo primero; su rechazo lo recoge el `catch` de
`Main.ejecutar` (log de error y `process.exit(1)`; en un cronjob, parada del sidecar y `process.exit(0)`, como con cualquier otro error de arranque). Después, si `modoPubSub(process.env).emulador` no es `null`, escribe
`Pub/Sub: emulador <host> (<proyecto>)` con `info` (solo el proceso primario en modo cluster). Sin la variable, no hace ni registra nada.

Las variables solo las inyecta `mrpack devel -p` en los procesos que lanza; no se escriben en código ni en ficheros versionados.

---

## Engine base

**Entrada:** `@mr/core-workload/engine`

```ts
import {Engine} from "@mr/core-workload/engine";
import type {TAbort} from "@mr/core-workload/engine";
```

Clase base para todos los engines del monorepo.

```ts
class MiEngine extends Engine<MiConfig> {
    protected async init(): Promise<void> {
        // lógica de arranque
    }
}

// En main.ts
Main.ejecutar(MiEngine, MiConfig);
```

### Ciclo de vida

```
Engine.build(config, unix)
  └─ syncCredenciales()   — symlinks en files/credenciales/
  └─ prebuild(config)     — hook estático sobreescribible
  └─ construir(config)    — new this(config, unix)
         │
         ▼
engine.master()  →  initMaster()   — hook para lógica de proceso primario
engine.ejecutar() → init()         — hook principal de arranque
```

### Utilidades de instancia

| Método | Descripción |
|--------|-------------|
| `abort(motivo?)` | Cancela el `AbortController` interno. |
| `abortSignal` | `AbortSignal` para operaciones cancelables. |
| `solicitarApagado(motivo)` | Único camino al `shutdown()`: aborta `abortSignal` (si no lo estaba) y ejecuta `shutdown()` **una sola vez**, aunque se pida por varias vías (watcher del lock, cierre del servidor, señal). Nunca rechaza. |
| `apagadoPorServidor` | `true` si el servidor HTTP del proceso atiende él mismo `SIGTERM`/`SIGINT` (en la base, `false`). |
| `shutdown()` *(protegido)* | Hook de apagado, no-op en la base; las subclases lo sobreescriben con `override`. **Se espera, con presupuesto** (hasta `shutdownTimeout`; sin HTTP, el mismo plazo); lo que se dispare sin esperar solo cuenta con el ~1 s de `antesDeSalir`. **En Kubernetes se ejecuta al aparecer el `shutdown.lock`, antes del margen y del drenado**, con el servidor todavía atendiendo peticiones; solo sin lock (SIGTERM directo) arranca en paralelo con `close()`. No cierres ahí lo que las peticiones necesitan (pools de BD, clientes): eso va en `server.antesDeSalir`, que corre después del drenado. |
| `usoMemoria()` | Registra consumo de memoria en el log. |
| `usoTiempo()` | Registra tiempo transcurrido desde `inicio` en el log. |

---

## Configuracion base

**Entrada:** `@mr/core-workload/config`

```ts
import {Configuracion} from "@mr/core-workload/config";
import type {IConfiguracion} from "@mr/core-workload/config";
```

Extiende `Configuracion` de `@mr/core-utils` añadiendo `pod: IPodInfo` (metadatos de pod
resueltos en tiempo de arranque: host, servicio, zona, versión, replica, wire, deploy...). `pod.buckets` son los buckets del entorno (`deploy.buckets`); si una clave
lleva `basePath` en el manifiesto (`{buckets, basePath}`), `pod.buckets` solo trae sus nombres y el prefijo va en
`pod.bucketsBasePath` (`aplanarBuckets()`).

```ts
class MiConfig extends Configuracion<IMiConfig> {
    public static async load(): Promise<MiConfig> {
        return this.cargar<IMiConfig>({
            timeout: 5000,
        }) as Promise<MiConfig>;
    }
}
```

### `cargar(defecto)`

Método estático protegido que cada subclase invoca desde su propio `load()`. Combina en
paralelo (`Promise.all`):

1. Los metadatos del pod (`crearPodInfo()`).
2. Las sobreescrituras de `files/config.json`, si el fichero existe; si no, `{}`.

El resultado se construye como `new this(defecto, cfg)`: cada subclase aplica su propio
merge `user ?? defecto` campo a campo en el constructor.

> **`files/config.json` no es un fichero de configuración autocontenido.** Solo
> sobreescribe, campo a campo, los valores por defecto que cada servicio define en su
> propio código (el `defecto` que se pasa a `cargar`). Puede omitirse o dejarse vacío
> (`{}`), en cuyo caso el servicio arranca con esos valores por defecto tal cual.

---

## `ConfiguracionNet`

**Entrada:** `@mr/core-workload/config/net`

> Migrado desde `@mr/core-network/server/http/config/config`.

```ts
import {ConfiguracionNet} from "@mr/core-workload/config/net";
import type {IConfiguracionNet} from "@mr/core-workload/config/net";
```

Extiende `Configuracion` añadiendo la propiedad `net: Net`. Si `defecto.net` es
`undefined`, se resuelve automáticamente desde `services.configuracion(this.pod.servicio)`.

---

## Engine HTTP

**Entrada:** `@mr/core-workload/engine/server`

```ts
import {Engine} from "@mr/core-workload/engine/server";
import type {IConfig} from "@mr/core-workload/engine/server";
```

Extiende `Engine` base añadiendo el servidor HTTP/HTTPS, los handlers de admin/error/favicon
y un watcher de shutdown por fichero.

```ts
import {Engine} from "@mr/core-workload/engine/server";
import {Routes} from "@mr/core-network/server/http/routes";
import Admin   from "@mr/core-workload/handlers/admin";
import ErrorH  from "@mr/core-workload/handlers/error";
import Favicon from "@mr/core-workload/handlers/favicon";

class MiEngine extends Engine<MiConfig> {
    protected override async init(): Promise<void> {
        await super.init();
        this.initWebServer(
            [MiGrupo.build(this.configuracion)],
            this.configuracion.net,
            {idiomas: {idiomas: ["es", "en"], defecto: "es", enabled: true}},
        );
    }

    public override async started(): Promise<void> { /* ... */ }
    public override async ready():   Promise<void> { /* ... */ }
    public override async okAll():   Promise<void> { /* ... */ }
}
```

### `IConfig`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `error` | `RouteGroupError` | Handler de error personalizado. Por defecto usa `handlers/error`. |
| `idiomas` | `IIdiomas` | Configuración i18n del servidor HTTP. |
| `cache` | `NetCache` | Implementación de caché. Por defecto `NetCacheDisk`. |

### `initWebServer` / `initWebServerS`

Ambos métodos:
1. Llaman a `iniciar()` que añade automáticamente `Admin(config, this)` y `Favicon(config)`,
   configura la caché en cada grupo y recoge tanto los `IWSHandler` (`getWSHandlers()`) como los
   `IUpgradeHandler` (`getUpgradeHandlers()`) de todos los grupos.
2. Crean `Routes(handlers, errorHandler)`.
3. Arrancan el servidor HTTP (o HTTPS en `initWebServerS`), pasándole también los descriptores
   de upgrade recogidos.
4. Si hay WebSocket handlers, inician el servidor WebSocket.

> Un servicio no debería declarar `getWSHandlers()` y `getUpgradeHandlers()` a la vez: ambos se
> enganchan al mismo evento nativo `'upgrade'` y `iniciar()` avisa por `warning` si detecta la
> combinación. Ver [`@mr/core-network/server/http/README.md#upgrade`](../network/server/http/README.md#upgrade)
> para el mecanismo de reenvío (`proxyUpgrade`) que usan los descriptores de upgrade.

### Watcher de shutdown

Durante `init()`, si existe el directorio `files/tmp/`, se monta un watcher de
`chokidar` sobre `files/tmp/admin/`. Si aparece el fichero `shutdown.lock`,
el engine marca `preStopSolicitado` (lo lee el heartbeat y hace que `/admin/ready/` responda 503) y llama a `solicitarApagado()`, que aborta `abortSignal` y ejecuta `shutdown()` una sola vez.

Antes de que nadie vigile la carpeta, `Main` **borra un `shutdown.lock` que ya exista** (`engine/lock.ts`, `borrarLockApagado`), **una
sola vez por pod** (modo simple o primario, antes de forkear): el preStop lo escribe en un `emptyDir`, que pertenece al pod y
sobrevive a un reinicio del contenedor por la liveness, y el contenedor nuevo lo habría encontrado al arrancar y se habría
apagado solo. No lo hace `init()` de cada worker: uno que arrancase tarde borraría un lock legítimo de un pod que ya termina.

### Apagado por señal (`SIGTERM`/`SIGINT`)

Desde que el `run.sh` de las imágenes arranca con `exec node <yarnPath> …`, `SIGTERM` llega a Node. En los proyectos cuyo preStop solo
escribe `shutdown.lock` (sin `sleep`), el framework se encarga solo del reparto de los 25 s de `terminationGracePeriodSeconds`,
contados desde el inicio del preStop (t = 0):

| Qué | Cuánto |
|-----|--------|
| **Margen de endpoints** (`engine/lock.ts`, `margenPendienteMs`): se espera `max(0, 3 s − (ahora − mtime(shutdown.lock)))` con el servidor **aún atendiendo** y `/admin/ready/` ya en 503. Con un `sleep 3` en el preStop ya ha pasado (~0); sin él, ~3 s; sin lock en producción, 3 s completos; fuera de producción, 0 | ≤ 3 s |
| `Server.close()` en paralelo con el `shutdown()` del engine (`duranteCierre`), que comparten `shutdownTimeout` | ≤ 18 s |
| `antesDeSalir` (despedida del heartbeat) | ≤ 1 s |
| Salida (el límite duro se arma **tras** el margen) | ≤ 22 s; límite duro 23 s |

`shutdownTimeout` de producción se recorta a 18 s si es mayor o ≤ 0 (`warning`); los menores se respetan.

Quién atiende la señal (`engine/apagado.ts`, `atenderSenal`), según el proceso:

- **Servicio HTTP** (modo simple o worker): el servidor (`Server.attachSignals`); `Main` no hace nada (`apagadoPorServidor`).
- **Primario de cluster**: `instalarCierrePrimario`, **con o sin heartbeat**: reenvía la señal a los workers, espera `margen + 19 s` a que salgan,
  se despide si hay heartbeat (≤ 1 s) y sale con 0 (≤ 23 s). Cada worker calcula su margen con el mismo lock.
- **Proceso sin HTTP de larga vida**: `solicitarApagado()` con tope 18 s (2 s en desarrollo), despedida del heartbeat ≤ 1 s y `exit(0)`.
- **Cronjob/job con `master()` o `ejecutar()` en marcha** (`pod.cronjob` o `deploy.type` `job`; la marca se pone justo tras construir el engine,
  así que una señal durante `master()` tampoco hace salir con 0 un Job a medias): en **producción**, `solicitarApagado()` y **no sale**: acaba
  cuando termina `ejecutar()` por el camino normal de `Main`, o por `SIGKILL`. En **desarrollo** sale tras el `shutdown()` con tope de 2 s y
  código `128 + n`: `node --watch` (`g:devel`) manda `SIGTERM` al guardar y espera sin tope, y un cronjob que no mira `abortSignal` no se reiniciaría.
- **Segunda señal** (cualquiera de las dos), también en el **primario de cluster**: salida inmediata con `128 + n` (143 con `SIGTERM`,
  130 con `SIGINT`). Lo mismo si la señal llega antes de que exista el engine. Si el servidor HTTP atiende la señal, `Main` no la escribe en
  el log (ya lo hace el servidor); solo la repetida.

Además guarda el último resultado de `GET /admin/ready/` (`ultimoReady`, vía `registrarReady`) para que la
sonda del heartbeat no repita una consulta que, en algunos servicios, va a Elastic.

---

## Heartbeat

**Entrada del contrato:** `@mr/core-workload/heartbeat/interface` (solo tipos y constantes, sin imports de Node).
`IHeartbeat` es **la única declaración del mensaje**: `status-external` la importa de aquí, no al revés.

Cada pod de un servicio manda un heartbeat por WebSocket a `status-external`, **cada segundo y sin esperar
respuesta** (`WSPool.head()`; solo la despedida espera un acuse, ver `parado`), para saber en tiempo real el estado de todos los pods de todos los monorepos.
El receptor guarda el último de cada pod y da por muerto al que lleva unos 5 s callado. `Main` lo arranca
al empezar el arranque (antes de cargar la configuración y del sidecar) y no hay nada que llamar desde el servicio.

### Cuándo emite

Solo si se cumplen **las tres**, y apagado por defecto:

1. `manifest.deploy.type` es `service`, `cronjob` o `job` (no worker ni browser), y
2. `manifest.deploy.target` es `k8s` (`IPodInfo.tipo` y `IPodInfo.target`), y
3. `HEARTBEAT=true`.

Un **cronjob** o un **job** (carga finita) solo emite en modo simple, y su latido lleva `carga` (`cronjob` o `job`) y `ejecucion`
(`IHeartbeatEjecucion`); un servicio no manda ninguno de los dos y su latido es el de siempre. En una carga finita:

- `listo` significa «en curso» y es el estado desde que el pod tiene engine (`Main` llama a `setEngine` antes de `master()`); no se llama a
  `started()`/`ready()`. La ejecución acaba en `parado`.
- La `revision` va vacía (el hostname del pod de un Job lleva la hora programada, que parecería un `pod-template-hash`).
- La ejecución sale del entorno que inyecta el kustomize —`CRON_NOMBRE`, `CRON_SCHEDULE`, `CRON_TIMEZONE`, `CRON_CONCURRENCIA`,
  `CRON_PLAZO_INICIO_S`, `CRON_PLAZO_EJECUCION_S`, y por Downward API `POD_JOB` y `POD_JOB_UID`—; todas pueden faltar (`carga.ts`). La hora
  programada se toma del nombre del Job (`<cronjob>-<minutos desde epoch>`) solo si es coherente con el arranque del pod; un `job`
  nunca la tiene.
  En un Job `Indexed`, Kubernetes inyecta `JOB_COMPLETION_INDEX` y el latido lo lleva en `ejecucion.indice`: solo vale un entero decimal
  de 0 a 65535 (sin signo ni decimales); vacío, `abc`, `-1`, `3.5` o `70000` dan `null`. El campo es opcional en el contrato (un emisor
  anterior no lo manda; el receptor lo toma por `null`). Cómo se identifica el Job: `POD_JOB`, o el hostname sin su último trozo
  `-xxxxx`; en un Indexed, el hostname es `<job>-<índice>` (documentación de Kubernetes, no medido aquí), que no casa con eso, así que **con
  `indice` y sin `POD_JOB`**, si el hostname termina en `-<índice>`, el Job es el hostname sin ese sufijo (y el CronJob, deducido sin
  `CRON_NOMBRE`, sale de ese Job). Sin `indice` todo sigue igual. Aun así, lo robusto es que el kustomize de un Job paralelo inyecte `POD_JOB`.
- **Despedida** (`Main`, `terminarEjecucionFinita`): al acabar `ejecutar()` manda `parado` con `resultado` `ok` o `error` (en `error`,
  solo `err.name`, nunca el mensaje; también cuenta un fallo de `master()`, aunque `ejecutar()` se haga igualmente), **después** para el
  sidecar de Istio y sale con 0 (el código de salida no refleja el fallo: lo cuenta el heartbeat). La despedida espera al contexto (los
  metadatos de GKE) dentro de un presupuesto total de 3 s (`PRESUPUESTO_DESPEDIDA_FINITA_MS`), porque una ejecución corta puede acabar antes
  de tenerlo. Tras una señal (`SIGTERM` en producción, p. ej. `activeDeadlineSeconds`) el pod pasa a `drenando/senal` y el proceso sigue
  hasta que acaba `ejecutar()` o lo mata Kubernetes.
- **Ejecución cortada por la señal**: si hubo señal durante la ejecución, el `parado` **no declara resultado**: `ejecucion.resultado` `null`,
  `ejecucion.error` `null` y `causaDrenado` `senal` (se fuerza, porque el ciclo que la evaluaría puede no haber corrido), tanto si `ejecutar()`
  resolvió al atender el aviso como si falló después (decisión: `cortada` gana a `error`, porque Kubernetes ya la dio por fallida y lo útil para quien
  mira el panel es que la cortaron; el nombre del error solo queda en el log del pod). El receptor lo traduce a `cron_run.result` `cortada` y a
  `resultado: cortada` en el evento de Elastic. Contrato `IHeartbeat` v1 sin cambios: `resultado: null` ya era válido (un receptor anterior acepta el
  latido y, si ya sabe leer la causa, lo marca `cortada`; si no, lo deja como un `parado` sin resultado), así que no obliga a ordenar el despliegue.

### Arranque temprano y arranques fallidos

`Main.start()` lee `crearPodInfo()` y arranca el heartbeat (`arrancando`) **antes** de `configLoader.load()` y de esperar al sidecar, en servicios y
en cargas finitas. Así un proceso que muere cargando la configuración o esperando al sidecar ya ha mandado su latido, y el receptor cuenta el
reinicio (mismo pod, `boot` mayor) en vez de no ver nada. El sidecar ya está listo cuando arranca la app (`holdApplicationUntilProxyStarts`).
Solo usa el entorno, `package.json` y `mrpack.json`; no depende de la configuración del servicio. `crearPodInfo()` se llama otra vez al cargar la
configuración: en producción da lo mismo (sale del hostname), en desarrollo `replica` y `deploy` son aleatorios y difieren entre las dos lecturas.
Sin `HEARTBEAT=true` no se hace nada nuevo.

Si `start()` rechaza en un servicio, `Main.ejecutar` espera **como mucho 1 s** (`PRIMER_ENVIO_ESPERA_MAX_MS`, handshake incluido) a que el primer envío
**haya salido del proceso** antes de `process.exit(1)`: `Heartbeat.esperarPrimerEnvio` espera al `head()` y después a `pool.vaciar()`
(`bufferedAmount === 0`), porque `head()` resuelve en cuanto `ws.send()` encola el frame y un `exit` en ese mismo encadenado lo perdía (medido: 0 frames
de 27 arranques fallidos con fallo de `load()` a 0–5 ms y handshake de 0, 150 y 400 ms; 27 de 27 con el arreglo). El código de salida no cambia y no se manda `parado` (sería una despedida limpia). Una carga finita que falla antes de saber que
lo es (falla cargando la configuración o esperando al sidecar) sigue ese mismo camino, con `exit(1)` para que el Job reintente según su
`backoffLimit`, pero **antes para el sidecar** (`Main.pararSidecarSiFinita`, solo el proceso del pod, nunca un worker): sin sidecar nativo,
`istio-proxy` no termina con la aplicación y el pod se quedaría en `Running` con el Job colgado (con `Forbid`, saltándose las siguientes
ejecuciones) hasta `activeDeadlineSeconds`. Que es finita lo dice ya el manifiesto que lee `crearPodInfo()`. Una que ya está en marcha se despide
con `error` y sale con 0, como siempre.

La parada del sidecar (`engine/sidecar.ts`, `pararSidecar`) espera la respuesta de `POST /quitquitquit` **como mucho 2 s**
(`PARADA_SIDECAR_MAX_MS`): contesta al momento, pero un proxy que acepta la conexión y no responde dejaría el proceso sin llegar a salir.

### Despedida confirmada

Medido en producción el 2026-11-18: un pod de status-backend se quedó en `drenando` sin llegar a `parado`. Lo medido: los callbacks de `antesDeSalir`
superaron el presupuesto de 1 s en el backend y en el receptor que se apagaba a la vez, y el `parado` no llegó. Lo más probable, **no observado**: la despedida
esperaba, sin tope, a un ciclo cuyo `head()` estaba atascado en una reconexión (hasta 5 s); que no apareciera «Heartbeat descartado» no lo descarta, porque
`avisarDescarte` limita a un aviso por minuto. Además, el
receptor que recibía los latidos se apagaba a la vez. El `parado` es el único latido que no se cura solo con el siguiente, así que es el único con acuse.

- **Contrato** (`interface.ts`): `METODO_HEARTBEAT_CONFIRMADO` (`"heartbeat-confirmado"`), en la misma ruta y con la misma autorización, con el mismo
  `IHeartbeat` (sin cambios). **Contesta** una `IConfirmacionHeartbeat {v: 1, resultado: "confirmado"|"reintentar"}`, o un error si el latido no es
  válido. `METODO_HEARTBEAT` no cambia y **sigue sin contestar nunca**. El acuse es en memoria: «lo tengo», no «ya está en MySQL».
- **Emisor** (`despedida.ts` puro, con pools, reloj y fábrica de pool nuevo inyectados; `emisor.ts` lo usa):
  1. Espera a un envío en vuelo **como mucho `ESPERA_VUELO_MAX_MS` (100 ms)**: un ciclo atascado ya no le quita el presupuesto. Los ciclos no mandan nada
     una vez empezada la despedida (su `seq` sería mayor que el del `parado`).
  2. Sin contexto resuelto no se manda nada (como antes). Si no, construye el `parado` **una sola vez** (mismo `seq` en todos los intentos: repetirlo es inocuo).
  3. **Intento 1** por el pool del emisor (`get`, hasta 300 ms). Ojo, no es «la conexión caliente»: si el receptor se apagó antes, su `Shutdown` ya sacó la conexión del pool y
     este intento paga un handshake nuevo (medido: en 5 de 6 despedidas fallidas el intento 1 fue ya una conexión nueva). Solo es una conexión ya abierta si nada la ha cerrado. `confirmado`: fin. `ok:false` (un receptor anterior, que contesta al momento «No handler for
     method»): `head(METODO_HEARTBEAT)` de reserva más `vaciar` y fin, **sin reintento**.
  4. Sin respuesta, caída, circuito abierto o `reintentar`: **un único reintento** (intento 2) por un **pool nuevo** de un solo uso (`WSPool.get` con `reconnect: false`, otra clave del
     singleton y por tanto otra conexión **por el mismo Service**, que cae en otra réplica solo si hay otra viva que acepte (si solo queda una, es la misma); `adaptarPool` en `pool.ts`, fábrica `abrirNuevo` en `crear.ts`), destruido tras el intento. Su tope es **todo lo que queda del presupuesto menos `MARGEN_RESERVA_MS` (100 ms, para el `head` de reserva si contesta `ok:false`)**, no 300 ms: una conexión nueva paga DNS + TCP + TLS + upgrade (~300-600 ms tras Cloudflare) y varios intentos cortos abandonarían el handshake a medias cada vez.
  5. Presupuesto total de **900 ms desde `despedir()`**, por debajo del 1 s de `antesDeSalir`, `despedirAcotado` y Next. `destroy()` siempre. Nunca rechaza.
  6. Logs: nada si se confirma al primer intento; `info` si se confirma (o sale por reserva) en el intento ≥ 2, con intentos y ms; `warning` si no se confirma, con el motivo de **cada** intento,
     p. ej. `intento 1: sin respuesta en 300 ms (no llegó a haber conexión); intento 2: sin respuesta en 395 ms (había conexión desde los 120 ms)`. «Había conexión» es que `WSPool.get()` resolvió
     (hay un socket por el que enviar: puede ser uno ya abierto que en realidad está muerto), no que el receptor haya contestado nada; «no llegó a haber conexión» es que el handshake no se completó
     a tiempo. Se distinguen con `IPoolHeartbeat.get(..., {alConectar})`, que `adaptarPool` llama entre `pool.get()` y la lectura de la respuesta.
  7. **`sin-confirmar` no es «perdido»**: el intento abandonado puede llegar igualmente si su handshake abre antes del `exit`, y el receptor lo aplica. Es «no sé si llegó».
- **Lo que no arregla por sí misma** (medido el 2026-11-18): cuando moría un `status-external` con carga mandaba `Shutdown` a todos sus clientes y estos reconectaban a la vez contra los que quedan (340–575 conexiones en 2–3 s);
  el superviviente se atascaba 3–4 s. Todas las despedidas fallidas (7 ese día) fueron por eso: ni el intento 1 ni el 2 obtuvieron respuesta, y el 2 no ha funcionado ni una vez en producción
  (solo quedaba una réplica, la atascada). Es saturación del receptor por la avalancha de reconexiones, y ninguna variante de la despedida dentro de 1 s lo arregla.
  **Lo ataca el servidor WebSocket de `@mr/core-network`**, no este emisor: desde su entrada del 2026-11-18, `shutdown()` reparte el `Shutdown` entre sus clientes (~40/s, hasta 10 s, con 50 o más)
  y da jitter a la vida de cada conexión, de modo que el que muere ya no devuelve a todos a la vez contra el que queda y el intento 1 (o el reintento) encuentra un superviviente tranquilo: si al morir
  el receptor aún no ha mandado el `Shutdown` a la conexión de este emisor, contesta `reintentar` y el reintento abre una conexión nueva hacia otra réplica; si ya lo mandó, el pool reabre bajo demanda contra un superviviente.
  Este paquete **no cambia de comportamiento** por ello y **no usa `refillJitterMs`** del pool (opción nueva de core-network), a propósito: así no depende de la versión nueva y versiones mezcladas compilan.
- **Compatibilidad**: emisor viejo + receptor nuevo = `head` como siempre; emisor nuevo + receptor viejo = `ok:false` al momento y `head` de reserva (un viaje de ida y vuelta más);
  si el receptor viejo se apaga y calla, 300 ms y una conexión nueva hacia uno vivo con el resto (hasta 500 ms), dentro del tope de 900 ms.
- **Sin medir** (ver `README` de `status-external`): que el sidecar de Istio deje abrir conexiones salientes nuevas mientras drena, y el coste de una conexión nueva por Cloudflare.
  Si la medida falla, la contingencia es abrir el pool de reserva al pasar a `drenando`.
- `requestTimeoutMs` de los pools del heartbeat es 1000 (solo la despedida usa `get()`): los temporizadores de `WSPool` no llevan `unref`.

### Variables de entorno (lo que tiene que poner cada proyecto en su yml)

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `HEARTBEAT` | sí | `"true"` para emitir. |
| `HEARTBEAT_TOKEN` | en producción y test | Va en la cabecera `x-mr-heartbeat` del handshake. Sin token en producción se avisa una vez y no se emite; **tampoco se emite, con un aviso (sin el valor), si no tiene la forma `hb1.<id>.<secreto>`** que acepta el receptor (`id` de 1 a 32 y secreto de 1 a 200 caracteres de `A-Z a-z 0-9 _ -`; solo se comprueba la forma, si es el bueno lo decide el receptor). Fuera de producción se emite igual y sin comprobar el formato (el receptor de desarrollo acepta cualquiera). |
| `HEARTBEAT_SOCKET` | solo fuera de producción | Dirección **base** del receptor, p. ej. `ws://proxy-svc-status-external.services.svc.cluster.local`. Por defecto `https://status.meteored.com`. **Fuera de producción no hay valor por defecto**: sin ella se avisa y no se emite, para no mandar nunca heartbeats locales a producción. |
| `POD_DPTO`, `POD_PRODUCTO` | no | Las rellena la Downward API desde las etiquetas `dpto` y `producto` del pod (`fieldRef: metadata.labels['dpto']`). Pueden llegar vacías. |
| `POD_REVISION` | no | La rellena la Downward API desde la etiqueta `pod-template-hash` (`fieldRef: metadata.labels['pod-template-hash']`): la revisión del ReplicaSet. Tiene que encajar con `^[a-z0-9]{1,16}$` (lo que acepta el receptor); si no, se manda vacía y se avisa una vez. Si no llega, en producción se usa el penúltimo trozo del hostname cuando tiene la forma `<deployment>-<hash>-<sufijo>`; si no, vacía. |
| `K8S_NAMESPACE` | no | Namespace; sin ella el campo va vacío. |
| `HEARTBEAT_CLUSTER`, `HEARTBEAT_PROYECTO`, `HEARTBEAT_UBICACION` | no | Fuerzan el valor y **mandan sobre el servidor de metadatos**. Si están las tres, no se espera a nada. |
| `ENTORNO` | no | Solo se contrasta con el entorno del bundle: si no coincide, un `warning` una sola vez, **solo si el heartbeat está habilitado** (un cronjob o un servicio sin `HEARTBEAT=true` no lo da). El entorno real sale de `entornoActual()`. |

«Producción» aquí es todo lo que no es desarrollo (test también, como en `crearPodInfo`).

**La URL.** `HEARTBEAT_SOCKET` es una dirección base: si no trae ruta (o es `/`) se le añade
`/status/external/heartbeat/` (`RUTA_HEARTBEAT`), que es lo que mira el VirtualService de Istio para encaminar
el upgrade; si ya trae una ruta distinta de `/`, se respeta tal cual.

### Estados

`arrancando` · `listo` · `no-listo` · `drenando` · `parado` (`TEstadoPod`).

- `arrancando`: el engine aún no existe, `ejecutar()` no ha resuelto o `started()` todavía no ha resuelto.
- `listo` / `no-listo`: el mismo resultado que daría `/admin/ready/`. `handlers/admin.ts` guarda el último; si
  tiene menos de 2 s se usa, y si no la sonda llama a `engine.ready()` con un timeout de 900 ms. Un engine sin
  HTTP es `listo` cuando `ejecutar()` resuelve.
- `drenando`, con `causaDrenado`:
  - `"senal"`: `Server.alIniciarCierre` (se recibió `SIGTERM`/`SIGINT`, justo al empezar el cierre, **antes** de
    `close()`) o `server.isShuttingDown()`.
  - `"prestop"`: ha aparecido `shutdown.lock`, que escribe el hook preStop del kustomize en
    `files/tmp/admin/shutdown.lock`; el watcher del Engine HTTP lo marca (`preStopSolicitado`).
  - Si se dan las dos, manda `senal`. Es la que dirá, con el primer despliegue, si el `SIGTERM` llega de verdad
    a Node (el proceso 1 del contenedor es `node <yarnPath>`, que sí lo reenvía; ver «Apagado por señal»).
- `parado`: la despedida, **con acuse** (ver «Despedida confirmada» más abajo). `Server.antesDeSalir` construye el `parado` una vez, lo manda con
  `get(METODO_HEARTBEAT_CONFIRMADO)` y destruye los pools, dentro del presupuesto de 1 s de `antesDeSalir`. En un pod simple no hay `process.on("SIGTERM")` propio
  (el del servidor HTTP); el del primario de un cluster está más abajo. Para que se llegue a `antesDeSalir`,
  `Server.close()` cierra en paralelo el servidor WebSocket (sus clientes reciben `Shutdown` y se reconectan a otra
  réplica) y cierra las keep-alive ociosas (ver el README de `server/http`); `shutdownTimeout` es de 18 s en producción,
  para que quepan el margen de 3 s desde el `shutdown.lock` y el resto dentro de los 25 s de `terminationGracePeriodSeconds` (ver «Apagado por señal»).
- `shutdown.lock` lo **borra `Main` al arrancar el pod** (una vez, en el primario o en modo simple, antes de forkear; `engine/lock.ts`): el preStop lo
  escribe en un `emptyDir`, que sobrevive a un reinicio del contenedor por la liveness, y el contenedor nuevo se habría apagado
  solo al encontrarlo.

### Cómo se envía

- Un temporizador de 1 s con `unref()` (no mantiene vivo el proceso) y **un envío inmediato** cuando algo cambia:
  el engine existe, `ejecutar()` resuelve, aparece el preStop, entra la señal, o `/admin/ready/` cambia de resultado.
- **Un solo envío en vuelo.** Si el anterior no ha resuelto, el tick se salta y al resolver se manda **solo la
  última foto**. Si `head()` falla (p. ej. circuit breaker abierto) se descarta, con un `warning` como mucho
  cada minuto. **El aviso no distingue un 401 de un fallo de red**: `WSPool` no deja saberlo (el `WebSocket` de Node/undici
  no da el código del handshake rechazado, y ambos llegan como un fallo de conexión que abre el circuit breaker), así que el
  texto nombra las dos causas probables. Un token mal formado en producción sí se detecta antes, sin emitir (ver variables). No se acumulan heartbeats viejos. `seq` crece en cada heartbeat construido, así que un hueco en
  el receptor es un descarte.
- Pool: `WSPool.get({socket, headers: {"x-mr-heartbeat": token}, minConnections: 1, heartbeatTimeoutMs: 25000})`.
- Método WebSocket: `METODO_HEARTBEAT` (`"heartbeat"`).

### De dónde sale cada campo

| Campo | Origen |
|-------|--------|
| `entorno` | `entornoActual()` de `@mr/core-log/interface` |
| `cluster`, `ubicacion`, `proyectoGcp` | Servidor de metadatos de GKE (`instance/attributes/cluster-name`, `instance/attributes/cluster-location`, `project/project-id`; `node:http`, cabecera `Metadata-Flavor: Google`, 1 s de timeout cada una, en paralelo; se descarta toda respuesta sin esa cabecera). Se leen **solo en producción** (fuera de ella no se pregunta, y quedan vacíos salvo las `HEARTBEAT_*`), que mandan si están definidas. Forman parte de la clave de la tabla del receptor, así que **en producción no se emite hasta tenerlos**: se reintentan los que faltan con backoff (1, 2, 4… hasta 30 s), con **un solo `warning`** mientras siga fallando, y al resolverse hay **un `info`** con los tres valores y el origen de cada uno (`metadata`, `env` o `vacío`). No bloquea el arranque del servicio, solo la emisión; la despedida no espera a la lectura. |
| `revision` | `POD_REVISION` (`pod-template-hash` del ReplicaSet, por Downward API); si no llega, en producción el penúltimo trozo del hostname cuando tiene la forma `<deployment>-<hash>-<sufijo>` (hash de 5 a 10 caracteres, sufijo de 5); si no, vacío (también fuera del clúster). Cambia en cada rollout, también en los que solo cambian el yml y no la imagen (no cambia `version`). |
| `zona`, `version` | `pod.zona`, `pod.version` |
| `namespace`, `producto`, `departamento` | `K8S_NAMESPACE`, `POD_PRODUCTO`, `POD_DPTO` |
| `pod` | `os.hostname()` en producción; fuera de ella `<hostname>/<servicio>` (allí `pod.host` vale el nombre del servicio) |
| `servicio` | `servicioDePod(pod)` de `@mr/core-log/pod` |
| `inicio` | el `unix` de `Main` |
| `metricas` | RSS (`process.memoryUsage.rss()`); `loopP99` y `loopMax` de `monitorEventLoopDelay`, reiniciado en cada envío; `uptime` en segundos |

### Modo cluster (`minimo_hilos !== 1`)

**Un heartbeat por pod, no por worker.**

- Cada **worker** calcula su estado (la misma sonda) y se lo manda al primario por IPC cada segundo y de inmediato
  al cambiar: `process.send({cmd: "heartbeat", estado, causaDrenado})`, que `Main.addSlave` encaja en su
  `switch (message.cmd)`. El worker no abre ningún socket hacia el receptor.
- El **primario** emite un solo heartbeat agregado con `procesos: {total, listos}` (`RegistroWorkers`,
  `agregarEstados`): `drenando` si alguno drena; `listo` si todos los vivos están listos; `arrancando` si ninguno
  está listo y alguno arranca; `no-listo` en el resto (y `arrancando` sin workers, **salvo que ya hubiera drenado**: si después de drenar
  mueren todos, el agregado sigue `drenando` con su causa y no vuelve a `arrancando`). Un worker que lleva más de 3 s
  sin informar cuenta como no listo; uno que muere (`exit`) sale del total.
- **El primario y las señales.** `Server.attachSignals` se instala en `iniciarHTTP`, que corre en los workers, y `master()` no
  arranca servidor. **Con o sin heartbeat**, `Main` instala en el primario un manejador de `SIGTERM`/`SIGINT`
  (`heartbeat/cierre-primario.ts`) que (con heartbeat) marca `drenando` con causa `senal`, **reenvía la señal a cada worker**, espera a que
  salgan (como mucho el margen pendiente de endpoints más 19 s), manda `parado` (vacía y destruye el pool, como mucho 1 s) y sale con 0:
  23 s en el peor caso, dentro de los 25 s de gracia. **Sin heartbeat** hace lo mismo salvo `drenando` y `parado` (antes el primario moría
  por la acción por defecto de Node y dejaba workers huérfanos). Una **segunda señal** en el primario sale ya con `128 + n`. Ningún servicio con este `Main` usa hoy el modo cluster.

### Servicios Next

Un servicio Next.js (`framework: nextjs`) no arranca con `Main` ni tiene `Engine`: lo lanza `next start`. El heartbeat se arranca desde
`instrumentation.ts` y reutiliza todo el emisor: `Sonda` y `Heartbeat` no cambian; solo se les da un adaptador y un cierre propios.

**Entrada:** `@mr/core-workload/heartbeat/next` → `iniciarHeartbeatNext()`. En cada workspace Next, en la raíz:

```ts
// instrumentation.ts
export async function register(): Promise<void> {
    if (process.env["NEXT_RUNTIME"] === "nodejs") {
        (await import("@mr/core-workload/heartbeat/next")).iniciarHeartbeatNext();
    }
}
```

`mrpack init` lo genera y deja `@mr/core-workload` en `devDependencies` (se empaqueta, como `@mr/core-network`). Las variables de
entorno y las condiciones para emitir (`HEARTBEAT=true`, service de k8s…) son las de arriba.

**Por qué `instrumentation.ts`.** Next llama a `register()` **una vez por proceso, antes de servir el primer request** (en `next start`
y en `standalone`), así que es el único sitio que llega igual a las dos formas de arrancar y a Next 15.5 y 16. **Solo está probado con `next start`**: en `standalone` el `server.js` escucha en `HOSTNAME` (el nombre del pod) y no en `127.0.0.1`, así que el autosondeo fallaría y el pod saldría `no-listo`; ningún proyecto lo usa hoy (las imágenes son `next start`). La guarda
`NEXT_RUNTIME === "nodejs"` hace que el compilador del runtime edge elimine el `import()`. No toca `run.sh`, `Dockerfile-next` ni el
kustomize.

**Es síncrono y no puede fallar.** `register()` bloquea el primer request, así que `iniciarHeartbeatNext()` no espera nada (ni
`crearPodInfo` ni los metadatos de GKE): lo primero que hace es mirar `HEARTBEAT=true` (sin ella no lee ni el pod, así que un workspace sin `mrpack.json` no da avisos); el trabajo va en segundo plano y cualquier error acaba en un `warning`. Una guarda en
`globalThis[Symbol.for("@mr/core-workload/heartbeat-next")]` impide un segundo emisor en el mismo proceso (en `next dev`,
`register()` puede ejecutarse más de una vez y la guarda sobrevive a la reevaluación de módulos). **Si no está habilitado** (sin
`HEARTBEAT=true`, en desarrollo sin `HEARTBEAT_SOCKET`…) **no se instala nada**: ni manejador de señal, ni envoltorio de
`process.exit`, ni sondeo, ni borrado del lock. Siempre es modo `simple` (un solo proceso por pod).

**Estados sin `Engine`** (`heartbeat/next/sonda-next.ts`, `AdaptadorNext`, que la `Sonda` usa por duck typing):

| Estado | Cuándo |
|--------|--------|
| `arrancando` | Desde `register()` hasta el primer `GET http://127.0.0.1:$PORT/admin/started` bueno. |
| `listo` / `no-listo` | Cada segundo la `Sonda` llama a `ready()`, pero el `GET /admin/ready` se hace de verdad **cada 5 s** (`INTERVALO_AUTOSONDEO_MS`; atender el sondeo era más de la mitad de la CPU de reposo del heartbeat en Next, medido con `next start`) y entre sondeos se devuelve el último resultado (un éxito viejo puede tapar un fallo hasta 5 s; las llamadas simultáneas comparten el sondeo). Es **sin barra final** en la propia máquina (con `trailingSlash: false` una barra costaría un `308` más: el doble de peticiones por el enrutado y `proxy.ts` cada segundo, que subió la CPU en reposo del pod; el kubelet sigue con `/admin/ready/` y su `308`, y con `trailingSlash: true` el nuestro lo recibe y lo sigue, así que se mide lo mismo): 200–399 es `listo`, igual que el kubelet; cualquier otra cosa, un timeout de 900 ms o un `ECONNREFUSED`, es **un fallo**, y solo **10 s seguidos sin un sondeo bueno** (`PLAZO_NO_LISTO_MS`, el equivalente de `failureThreshold: 10` × `periodSeconds: 1` de la `readinessProbe` del kustomize: con sondeo cada 5 s, 2 fallos seguidos; un éxito reinicia la cuenta) dan `no-listo`: el kubelet no saca el pod de los endpoints por un fallo suelto y `/infra/pods` tampoco debe avisar. La consulta de `ready()` vence `MARGEN_SONDA_MS` (50 ms) antes que el plazo de la `Sonda`, para que un sondeo colgado pase por la cuenta y no lo declare fallido la `Sonda` por su cuenta (que no aplica histéresis propia). `started()` se pide cada segundo solo hasta el primer éxito (la `Sonda` no vuelve a llamarlo), así que `arrancando` → `listo` no espera 5 s, y no cuenta;  `drenando` (lock o señal) sigue siendo inmediato. Así `/infra/pods` dice lo mismo que los endpoints de k8s, y un Next que ya no contesta sale `no-listo` (o en silencio, si el event loop está atascado). La petición **sigue las redirecciones como el kubelet** (Next contesta `308` hacia la otra forma de la ruta según `trailingSlash`): una `Location` relativa, o absoluta `http` con el mismo host y puerto, hasta 10 saltos (más, rechaza), cada uno con su conexión y con los 900 ms como tope **total**; una redirección a otro host, puerto o protocolo no se sigue y el 3xx cuenta como `listo`, que es lo que hace el kubelet (la da por buena y solo avisa con un evento). El plazo es de 900 ms en producción y de **5 s fuera de ella** (`next dev`: mientras Next compila una página tarda más en contestar y saldría un `no-listo` falso; el plazo llega a `iniciarHeartbeat` por `timeoutSondaMs`). No deja conexiones vivas (sin agente y con `Connection: close`: una keep-alive haría esperar al `server.close()` de Next). |
| `drenando` (`prestop`) | Aparece `files/tmp/admin/shutdown.lock` (el preStop del kustomize). Next no tiene el watcher del Engine HTTP: un `stat` cada 500 ms (con `unref`). Antes de vigilar se borra un lock anterior (reinicio del contenedor por la liveness). |
| `drenando` (`senal`) | `ServidorCierreNext` (`cierre-next.ts`, un `IServidorCierre`) registra `SIGTERM`/`SIGINT`. Su manejador queda **después** del de Next, que ya ha hecho `server.close()` en el mismo tick. |
| `parado` | Next no da ningún gancho de salida, así que, al recibir la primera señal, se **envuelve `process.exit`**: la primera llamada (la de Next, con 143, o con 0 en la 15.5) ejecuta la despedida con un tope de 1 s (`DESPEDIDA_MAX_MS`) y después hace el `exit` real **con el mismo código**; las llamadas posteriores mientras está pendiente se ignoran. El tope lo mantiene un temporizador **con referencia**: sin él, con el bucle de eventos vacío, Node saldría solo con 0 en vez de con el código de Next. Si Next no termina dentro de la gracia llega `SIGKILL` y queda un «silencio esperado» tras drenar, que `status-external` ya acepta. |

`ServidorCierreNext` solo envuelve `process.exit` **tras la señal** y solo con el heartbeat activo. Si nadie más atiende la señal (p. ej.
con `NEXT_MANUAL_SIG_HANDLE`), su manejador anularía la acción por defecto de Node, así que sale él, tras la despedida, con `128 + n`.

**Lo que hay que saber**

- **Solo de servidor.** `heartbeat/next` importa `node:http`, `node:fs` y el cliente WebSocket (`WSPool`, que usa el `WebSocket` global de Node): no importarlo desde código
  compartido con el navegador (rompería el build con `Can't resolve 'fs'`). Tras el build, `x-mr-heartbeat` no debe aparecer en `.next/static`.
- **Dependencias del workspace Next:** `dd-trace` en `dependencies` (es externo en el servidor de Next; sin inicializar no hace nada. Si
  algún proyecto lo inicializara, el autosondeo crearía un span por segundo) y `@mr/core-workload` en `devDependencies`.
- **`buildDirs`.** El `next.config.js` base de `services-comun` añade `./instrumentation.ts` y el emisor al hash del `buildId` **si ese
  fichero existe**; sin eso, un cambio en el emisor no generaría imagen nueva.
- **Sin margen de endpoints.** Next no espera antes del `close()`, así que depende del `sleep 3` del preStop del kustomize para salir
  de los endpoints sin 5xx. `drenando(prestop)` precede unos 3 s a `drenando(senal)` sin transición nueva (la causa no cuenta para `tseq`).
- **Supuesto sin medir:** que Next termina llamando a `process.exit` (medido leyendo 15.5.4 y 16.4.6). Si algún día dejara que el
  bucle se vaciase solo, el socket del `WSPool` podría mantener vivo el proceso hasta `SIGKILL`: se vigila midiendo la duración de salida en cada rollout.
- **Versiones:** Next 15.5 o superior.

### En local

Con `HEARTBEAT=true` y `HEARTBEAT_SOCKET` apuntando al receptor local emite igual (token opcional). Sin
`HEARTBEAT_SOCKET`, avisa y no emite. No se consulta el servidor de metadatos, así que `cluster`, `ubicacion` y
`proyectoGcp` van vacíos salvo que se fuercen con las variables `HEARTBEAT_*`.

### Pruebas

`yarn workspace @mr/core-workload test` (`node:test`, `spec/`): estado y agregado de cluster (con la memoria del drenado), decisión de
habilitar (formato del token, avisos), URL, metadatos con reintento, payload y `revision`, contexto que falla, la sonda, el emisor con
un pool falso (también con el contexto pendiente y con un ciclo atascado en `head()`: el `parado` sale en < 150 ms), la despedida confirmada (`despedida.spec.ts`, con pools y reloj falsos; `despedida-ws.spec.ts`, con un servidor WebSocket escrito a mano y el `WSPool` real: receptor nuevo, receptor anterior y segundo intento por otro socket), el cierre del primario (con y sin heartbeat, con margen), el margen de endpoints y el borrado de `shutdown.lock`, el apagado una sola vez
(`ApagadoUnico`), `atenderSenal` (señal repetida, servidor, cronjob, proceso sin HTTP), los invariantes del presupuesto de 25 s y, para los servicios Next,
el adaptador (autosondeo y vigilante del lock, con un servidor HTTP de verdad), el cierre (con un proceso falso y con un proceso hijo real) y el arranque.

---

## Handler admin

**Entrada:** `@mr/core-workload/handlers/admin`

```ts
import Admin from "@mr/core-workload/handlers/admin";
```

Factory: `(config: Configuracion, engine: Engine) => Admin`

| Ruta | Descripción |
|------|-------------|
| `GET /admin/started/` | Lanza `engine.started()`; 200 OK o 404 con mensaje. |
| `GET /admin/ready/` | Lanza `engine.ready()`; 503 durante drain (SIGTERM, margen incluido) y desde que aparece `shutdown.lock`. |
| `GET /admin/live/` | Lanza `engine.okAll()`; liveness probe. |
| `GET /admin/check/` | Alias de `/admin/live/`. |
| `GET /admin/doc/` | Devuelve la lista de rutas documentables en JSON. |
| `GET /admin/metrics/` | Métricas en formato Prometheus (`text/plain; version=0.0.4`). |
| `POST /admin/debug-handoff/` | Solo fuera de producción: cede el puerto HTTP a una sesión de depuración (`server.cederPuertoParaDebug()`). En producción responde 404. |
| `GET /admin/pubsub/` | Solo fuera de producción: `data: {emulador, proyecto}` con `PUBSUB_EMULATOR_HOST` y `PUBSUB_PROJECT_ID` del proceso (`null` si no están definidas o están vacías). Los tests e2e lo usan para comprobar que un servicio está levantado en modo emulador. En producción responde 404. |

Ninguna ruta aparece en `/admin/doc/` (todas tienen `documentable: false`).

> **Handoff de puerto para depuración local:** ver la sección correspondiente en
> [`@mr/core-network/server/http/README.md`](../network/server/http/README.md#handoff-de-puerto-para-depuración-local-solo-produccion).

---

## Handler error

**Entrada:** `@mr/core-workload/handlers/error`

```ts
import ErrorH from "@mr/core-workload/handlers/error";
```

Factory: `(config: Configuracion) => HttpErrorHandler`

Implementa `RouteGroupError` (`IErrorHandler`). Responde con `404` a cualquier URL
no reconocida. En producción omite `extra` de la respuesta JSON para evitar filtrar
trazas o datos internos al cliente.

```ts
const routes = new Routes([...grupos], ErrorH(config));
```

---

## Handler favicon

**Entrada:** `@mr/core-workload/handlers/favicon`

```ts
import Favicon from "@mr/core-workload/handlers/favicon";
```

Factory: `(config: Configuracion) => Favicon`

| Ruta | Descripción |
|------|-------------|
| `GET /favicon.ico` | Sirve `assets/favicon.ico` con caché de 1 mes. 404 no-cache si no existe. |

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.

