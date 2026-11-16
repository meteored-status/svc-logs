# [Changelog](https://keepachangelog.com/en/1.1.0/)

## 2026.11.11 16:20 — [Miguel]

### Added

- **`src/navegador/apis/geolocation.ts`** (movido desde `@mr/user-mr-components/apis/geolocation`): `requestGeolocation` y `getLocation`. Export `./apis/geolocation`.

## 2026.11.10 20:25 — [Miguel]

### Changed

- **`navegador/communication/`: eventos por estrategia.** Cada estrategia (`IEstrategia`, p. ej. `EstrategiaNavegador`) recibe sus propios eventos, `TEventos` (por emisor: `{componente: {metodo: {when?, transporte?, listeners?}}}`, con `listeners` por componente y método (`{cookies: {actualizarLast: {}}}`), así se ve junto qué emite cada componente y quién lo escucha; el evento se llama `<componente>:<metodo>` y no se escribe en ningún sitio; el acceso a `emit` es directo y un emisor no puede repetirse), y los busca por el nombre del componente, que el componente dice en cada llamada: `IEstrategia.emit(componente, metodo, when, message)` y `.listen(componente, callback(metodo, message), signal)`, sin `crear`. Sin cancelación: `emit` no devuelve nada (en `Comunicacion`, `IEstrategia` y `ITransporte`; los `CustomEvent` ya no son `cancelable`), y `before` solo significa «antes de ejecutar». Quitadas `IMetodoComunicacion`, `Canales`, `IEvents`, `IEmit`, `TEventosProyecto` y `mergeEvents`; `IMessage` pierde `previous`. `EstrategiaNavegador` acepta `eventos` (el transporte va en el evento, `transporte`; antes el mapa `via`). `Navegador` pasa a llamarse `EstrategiaNavegador` y acepta `app?: EventTarget` para compartir el bus `app` entre varias estrategias.

## 2026.11.6 09:00 — [Miguel]

### Added

- **`src/navegador/communication/`** *(nuevo)* — lo justo para que un componente se comunique sin saber por dónde, en un solo nivel:
  - `eventos/index.ts`: `IEvento` (`when?`, `transporte?` —uno o varios—, `listeners?`: `{componente: {miembro: {}}}`, donde el miembro es un método, que se llama, o un atributo, que se asigna), `TEventos` (`{componente: {metodo: IEvento}}`), `decodificacionEventos(eventos, defecto)` con `IEventoDecodificado` (lista plana con los valores por defecto aplicados; es lo único que conoce la forma en que se escriben los eventos, así que los transportes y estrategias no dependen de ella), `IMessage` (con el origen, para evitar ecos) y `TWhen`.
  - `comunicacion.ts`: `IEstrategia` (una estrategia: `emit`/`listen` por nombre de componente, buscando los eventos que la estrategia le define) y `Comunicacion` (contiene las estrategias del proyecto y es lo que recibe un componente: `emit(componente, metodo, when, message)` pone el `origin` y emite por todas; `listen(componente, instancia)` escucha en todas, ignora los mensajes del propio componente y llama sobre `instancia` el método que dice el evento, con `value`). Cada estrategia tiene sus propios eventos: una puede conectarse a un método de un componente y otra a otro.
  - `navegador/`: la estrategia del navegador, ya hecha, con sus transportes en el mismo directorio (opcional). `index.ts`: `EstrategiaNavegador({eventos, defecto?, app?})`, con `app`, `window`, `document` y `broadcastChannel` ya definidos; cada evento elige su `transporte` o varios (`["app", "broadcastChannel"]`); `app` es el `EventTarget` del transporte `app` (dos estrategias que reciben el mismo comparten bus; se pueden poner varias en `Comunicacion`). `transporte.ts`: `ITransporte`. `transportes/evento-dom.ts`: `TransporteEventoDom` (eventos del DOM sobre cualquier `EventTarget`: `window`, `document` o uno propio). `transportes/broadcast-channel.ts`: `TransporteBroadcastChannel` (entre pestañas del mismo origen; un `BroadcastChannel` por evento; el `value` se clona; lo recibido lleva `origin` `remoto:<componente>`; no se puede cancelar ni lo recibe quien lo emite).
  Exports `./navegador/communication/comunicacion`, `.../eventos`, `.../navegador`, `.../navegador/transporte`, `.../navegador/transportes/evento-dom` y `.../navegador/transportes/broadcast-channel`.
- **`src/navegador/storages/cookies/`** *(nuevo)* — `manager` (`CookieManager`, tipos, expiraciones) y `services` (`base`, `legacycookieservice`). Exports
  `./navegador/storages/cookies/manager`, `.../manager/*`, `.../manager/tipos` y `.../services/*`.

### Fixed

- Restauradas en `package.json` las referencias (`exports`) a los módulos de `navegador/`, que un merge había quitado.

## 2026.11.3 12:00 — [Miguel]

### Added

- **`src/unidades/{magnitudes,portal}/`** *(nuevo)* — unidades de medida movidas desde
  `services-comun/modules/utiles/unidades` y separadas por magnitud (`velocidad`, `precipitacion`,
  `nieve`, `presion`, `temperatura`, `distancia`, `rayos`) en `magnitudes/` (con `index.ts` que lo reexporta) y el uso por portal aparte, en `portal/`.
  Exports `./unidades`, `./unidades/portal` y `./unidades/*`. Código sin cambios.
- Patch **R036** de `@mr/core-dev`: `services-comun/modules/utiles/unidades` → `@mr/core-utils/unidades`.

---

## 2026.6.17 — [Jose]

### Added

- **`README.md`** *(nuevo)* — documentación pública del paquete: descripción, tabla de
  módulos, patrón de extensión y jerarquía de configuración del monorepo.

- **`CODEMAP.md`** *(nuevo)* — mapa técnico: árbol de ficheros, superficie pública de
  `src/config.ts` y tabla de consumidores directos del paquete.

### Changed

- **`src/config.ts`** — JSDoc completo en `IConfiguracion` y `Configuracion<T>`:
  descripción de responsabilidades, parámetro genérico `@template T` y ejemplo de patrón
  de extensión en subclases.

---

## 2024.11.11+1
