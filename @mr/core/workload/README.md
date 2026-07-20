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
| [ConfiguracionNet](#configuracionnet) | `@mr/core-workload/config/net` | Configuración base de servicio con red (`net`) |
| [Engine base](#engine-base) | `@mr/core-workload/engine` | Clase base del engine: `build`, ciclo de vida, abort, métricas |
| [Engine HTTP](#engine-http) | `@mr/core-workload/engine/server` | Engine HTTP/HTTPS abstracto con watcher de shutdown |
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
| `usoMemoria()` | Registra consumo de memoria en el log. |
| `usoTiempo()` | Registra tiempo transcurrido desde `inicio` en el log. |

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
   configura la caché en cada grupo y recoge los `IWSHandler`.
2. Crean `Routes(handlers, errorHandler)`.
3. Arrancan el servidor HTTP (o HTTPS en `initWebServerS`).
4. Si hay WebSocket handlers, inician el servidor WebSocket.

### Watcher de shutdown

Durante `init()`, si existe el directorio `files/tmp/`, se monta un watcher de
`chokidar` sobre `files/tmp/admin/`. Si aparece el fichero `shutdown.lock`,
el engine llama a `this.abort()` y luego a `this.shutdown()`.

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
| `GET /admin/ready/` | Lanza `engine.ready()`; 503 durante drain (SIGTERM). |
| `GET /admin/live/` | Lanza `engine.okAll()`; liveness probe. |
| `GET /admin/check/` | Alias de `/admin/live/`. |
| `GET /admin/doc/` | Devuelve la lista de rutas documentables en JSON. |
| `GET /admin/metrics/` | Métricas en formato Prometheus (`text/plain; version=0.0.4`). |

Ninguna ruta aparece en `/admin/doc/` (todas tienen `documentable: false`).

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

