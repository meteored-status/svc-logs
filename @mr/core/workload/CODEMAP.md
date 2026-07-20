# CODEMAP - `@mr/core-workload`

Mapa tecnico del workspace `@mr/core/workload/`.

## Arbol

```text
@mr/core/workload/
├─ config/
│  ├─ index.ts        — Configuracion base + IConfiguracion (pod/env)
│  ├─ pod.ts          — creacion de IPodInfo
│  └─ net.ts          — ConfiguracionNet + IConfiguracionNet (config de red)
├─ engine/
│  ├─ index.ts       — Engine base (build, ciclo de vida, abort, métricas)
│  └─ server.ts      — Engine HTTP (initWebServer/S, shutdown watcher, prebuild)
├─ handlers/
│  ├─ admin.ts       — rutas /admin/* (healthchecks, doc, metrics Prometheus)
│  ├─ error.ts       — handler de error HTTP por defecto (404 / JSON)
│  └─ favicon.ts     — handler /favicon.ico
├─ index.ts          — Main, IEngine, IMainConfig
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json
└─ tsconfig.json
```

## Superficie publica

### `index.ts`

- `interface IEngine<T extends Configuracion = Configuracion>`
  - `build(configuracion, unix)` → `Promise<Engine<T>>` — factoría del engine; `unix` es el `Date.now()` de arranque
- `interface IConfiguracionLoader`
  - `load()` → `Promise<Configuracion>` — carga la configuración una única vez; tras la primera llamada, `Main` sobreescribe esta propiedad
- `interface IMainConfig`
  - `minimo_hilos?: number` (por defecto `1`)
- `class Main`
  - Metodo estatico publico: `ejecutar(engine, configLoader, cfg?)`
  - Constructor recibe `engine`, `configLoader` y `cfg`; `unix` se inicializa internamente
  - Modo de ejecucion unificado:
    - `minimo_hilos === 1`: modo simple
    - `minimo_hilos !== 1`: modo cluster
  - Metodos de ciclo de vida:
    - `checkSidecar()` — sondeo a `GET /healthz/ready`
    - `startSidecar(pod)` — reintentos progresivos hasta 10 × `intento×100ms`
    - `stopSidecar({pod?})` — `POST /quitquitquit`; errores de red silenciados
    - `addSlave()` — levanta un worker en modo cluster
    - `startMaster(configuracion, hilos)` — proceso primario en cluster
    - `startSlave(configuracion)` — proceso worker en cluster
    - `start()` — ciclo completo: load → sidecar → cluster/simple → cronjob cleanup

### `engine/index.ts`

- `type TAbort = (motivo?: string) => void`
- `class Engine<T extends Configuracion = Configuracion>`
  - Metodo estatico publico: `build(configuracion, unix)` (tipado polimorfico por subclase)
  - Metodos estaticos internos:
    - `syncCredenciales()`
    - `prebuild(...)`
    - `construir(...)`
  - Propiedades/estado:
    - `configuracion`
    - `inicio`
    - `abortSignal`
  - Ciclo de vida:
    - `master()` -> `initMaster()`
    - `ejecutar()` -> `init()`
  - Utilidades:
    - `abort(...)`
    - `usoMemoria()`
    - `usoTiempo()`

### `engine/index.ts`

- `type TAbort = (motivo?: string) => void` — firma de la función de cancelación del engine
- `class Engine<T extends Configuracion = Configuracion>`
  - Flujo estático:
    - `build(configuracion, unix)` → `Promise<TEngine>` — polimórfico; ejecuta `syncCredenciales → prebuild → construir`
    - `syncCredenciales()` *(privado)* — crea symlinks planos en `files/credenciales/` desde `files/.credenciales/<dir>/`
    - `prebuild(configuracion)` *(protegido, hook)* — no-op en la base; las subclases lo sobreescriben
    - `construir(configuracion, unix)` *(protegido)* — `new this(config, unix)`
  - Propiedades de instancia:
    - `configuracion: T` (protected readonly)
    - `inicio: number` (public readonly) — timestamp de arranque en ms
    - `abortSignal: AbortSignal` (getter público) — observado por operaciones cancelables
  - Métodos de ciclo de vida:
    - `master()` → `initMaster()` — proceso primario en cluster
    - `ejecutar()` → `init()` — arranque estándar (modo simple o worker)
    - `initMaster()` *(hook protegido)* — no-op en la base
    - `init()` *(hook protegido)* — no-op en la base; **debe sobreescribirse**
  - Utilidades:
    - `abort(motivo?)` — activa el `AbortController` interno
    - `usoMemoria()` *(protegido)* — imprime heap/buffers/rss en el log
    - `usoTiempo()` *(protegido)* — imprime tiempo transcurrido desde `inicio`

### `engine/server.ts`

Extiende `Engine` añadiendo el ciclo de vida HTTP/HTTPS, watcher de shutdown y los
hooks de salud que los handlers de admin necesitan.

- `interface IConfig`
  - `error?: RouteGroupError` — handler de error personalizado (por defecto `ErrorHandler`)
  - `idiomas?: IIdiomas`     — configuración i18n del servidor
  - `cache?: NetCache`       — implementación de caché (por defecto `NetCacheDisk`)
- `abstract class Engine<T extends ConfiguracionNet> extends EngineBase<T>`
  - Propiedades de instancia:
    - `handlers: RouteGroup[]` (privado) — lista de grupos activos; consultada por `okAll`
    - `routes?: Routes` (público) — tabla de rutas; disponible tras `initWebServer/S`
  - Hook estático sobreescribible:
    - `prebuild(configuracion)` — fija `Respuesta.setContextoDefecto(service/pod/version/zona)`
  - Hook de ciclo de vida:
    - `init()` — monta el watcher de `chokidar` sobre `files/tmp/admin/shutdown.lock`
  - Métodos de arranque (protegidos):
    - `initWebServer(handlers, net, config?)` — HTTP; añade Admin+Favicon, crea Routes, arranca HTTP+WS
    - `initWebServerS(handlers, net, config?)` — HTTPS fire-and-forget; idéntico con TLS SNI
  - Métodos privados:
    - `iniciar(handlers, config)` — lógica compartida de inicialización: i18n, Admin, Favicon, caché, WS handlers
  - Hooks de salud sobreescribibles:
    - `started()` — probe de arranque (`/admin/started/`); delega en `ok()`
    - `ready()` — probe de disponibilidad de tráfico (`/admin/ready/`); delega en `ok()`
    - `okAll()` — liveness probe (`/admin/live/`); verifica `handler.ok` de todos los grupos + `ok()`
    - `ok()` *(protegido)* — comprobación genérica personalizable; no-op en la base
    - `shutdown()` *(protegido)* — apagado graceful al detectar `shutdown.lock`; no-op en la base

### `config/net.ts`

- `interface IConfiguracionNet`
  - `net?: INet`
- `class ConfiguracionNet<T extends IConfiguracionNet = IConfiguracionNet> extends Configuracion<T>`
  - Propiedad: `net: Net`
  - Resuelve `defecto.net` desde `services.configuracion(this.pod.servicio)` cuando no se define en config.

> **Migración:** `ConfiguracionNet` se movio desde
> `@mr/core-network/server/http/config/config.ts` a `@mr/core-workload/config/net.ts`.

### `handlers/admin.ts`

Factory: `(config: Configuracion, engine: Engine) => Admin`

Grupo de rutas de administración interna. Ninguna aparece en la documentación pública.

| Ruta | Descripción |
|------|-------------|
| `GET /admin/started/` | `engine.started()` — ¿ha arrancado el servicio? |
| `GET /admin/ready/` | `engine.ready()` — ¿listo para tráfico? (503 durante drain) |
| `GET /admin/live/` | `engine.okAll()` — liveness probe |
| `GET /admin/check/` | Alias de `/admin/live/` |
| `GET /admin/doc/` | Lista de rutas documentables en JSON |
| `GET /admin/metrics/` | Métricas en formato Prometheus (`text/plain; version=0.0.4`) |

```ts
import Admin from "@mr/core-workload/handlers/admin";

const routes = new Routes(
    [Admin(config, engine), Favicon(config), miGrupo],
    ErrorH(config),
);
```

### `handlers/error.ts`

Factory: `(config: Configuracion) => HttpErrorHandler`

Implementa `IErrorHandler` (`RouteGroupError`). Responde con `404` a cualquier URL
no reconocida. En producción omite `extra` de la respuesta para no filtrar información interna.

```ts
import ErrorH from "@mr/core-workload/handlers/error";

const routes = new Routes([...grupos], ErrorH(config));
```

### `handlers/favicon.ts`

Factory: `(config: Configuracion) => Favicon`

| Ruta | Descripción |
### `handlers/admin.ts`
```

### `package.json`

- Sin bloque `exports` explicito.

## Flujo

### Main base

```text
Main.ejecutar(...)
  -> instancia Main(engine, configLoader, cfg)
  -> start()
     -> this.configLoader.load() (single-shot)
     -> startSidecar(...)
      -> si minimo_hilos !== 1:
           -> cluster.isPrimary ? startMaster(...) : startSlave(...)
      -> si minimo_hilos === 1:
           -> this.engine.build(...)
           -> engine.master()
           -> engine.ejecutar()
           -> cronjob: stopSidecar + process.exit()
```

### Engine HTTP (server.ts)

```text
Engine.build(config, unix)         ← hereda de Engine base
  -> syncCredenciales()
  -> prebuild()                    ← fija Respuesta.setContextoDefecto(service/pod/version/zona)
  -> construir(config, unix)

engine.init()
  -> monta watcher chokidar en files/tmp/admin/
     si aparece shutdown.lock → this.abort() + this.shutdown()

engine.initWebServer(handlers, net, config?)
  -> iniciar(handlers, config)     ← añade Admin + Favicon, setCache, recoge WSHandlers
  -> Routes(handlers, errorHandler)
  -> server.iniciarHTTP(routes, net)
  -> si hay WSHandlers: webSocket(http, ws)
```

## Dependencias destacadas

- Node: `node:cluster`, `node:events`, `node:fs`, `node:http`, `node:os`
- `services-comun/modules/utiles/config`
- `services-comun/modules/utiles/log`
- `services-comun/modules/utiles/promise`
- `services-comun/modules/utiles/fs`
- `services-comun/modules/net/cache`, `services-comun/modules/net/cache/disk`
- `@mr/core-network/server/http/*`
- `@mr/core-network/server/websocket`
- `chokidar`
