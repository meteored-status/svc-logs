# [Changelog](https://keepachangelog.com/en/1.1.0/)

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

