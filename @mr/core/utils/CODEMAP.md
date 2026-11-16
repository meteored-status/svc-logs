# CODEMAP — `@mr/core-utils`

Mapa técnico del workspace `@mr/core/utils/`.

## Árbol

```text
@mr/core/utils/
├─ src/
│  ├─ config.ts   — IConfiguracion (interfaz raíz) + Configuracion<T> (clase base)
│  ├─ navegador/communication/   (`@mr/core-utils/navegador/communication/<comunicacion|eventos|navegador>`)
│  │  ├─ eventos/index.ts            los tipos de eventos: `IEvento` (`when?`, `transporte?` —uno o varios—, `listeners?`: `{componente: {miembro: {}}}`, el miembro es un método o un atributo), `TEventos` (`{componente: {metodo: IEvento}}`: los eventos de **una estrategia**, por emisor y con los nombres que tengan los componentes en el proyecto), `IEventoDecodificado` y `decodificacionEventos(eventos, defecto)` (convierte la forma en que el proyecto escribe los `TEventos` en una lista plana con los valores por defecto aplicados: es lo único que conoce esa forma, y las estrategias trabajan con su resultado), `IMessage {origin, value}` y `TWhen`. El evento se llama `<componente>:<metodo>` del emisor
│  │  ├─ comunicacion.ts             `Comunicacion` y `TMensaje`; `IEstrategia` (una estrategia: `emit(componente, metodo, when, message)` y `escuchas(componente)`: lista de `{metodo, escuchar(callback, signal)}`, buscando en los eventos que la estrategia define) y `Comunicacion` (contiene las estrategias del proyecto y es lo que recibe un componente: `emit` pone el `origin` y emite por todas (no devuelve nada: no se puede cancelar); `add(nombre, interfaz, signal)` registra al componente con su interfaz pública (`crearInterfazPublica(this)`: `Comunicacion` no recibe su instancia), la envuelve con `emitirInterfazPublica` (cada llamada emite `before`/`after`), conecta cada evento que escucha a la entrada que dice (falla si falta alguna) y devuelve la interfaz envuelta, por la que el componente debe llamarse para emitir; cada estrategia descarta en `escuchar` los mensajes del propio componente). Es lo que exporta `config/comunicacion/index.ts`
│  │  └─ navegador/                  la estrategia del navegador: `EstrategiaNavegador` y sus transportes, en un solo directorio
│  │     ├─ index.ts                    `EstrategiaNavegador({eventos, defecto?, app?})`: eventos del DOM y `BroadcastChannel` con sus transportes ya definidos (`app`, `window`, `document` y `broadcastChannel`; cada evento elige el suyo, o varios, con `transporte`); `app` es el `EventTarget` del transporte `app` (por defecto uno por estrategia; dos que reciben el mismo comparten bus); se pueden poner varias en `Comunicacion`, cada una con sus eventos
│  │     ├─ transporte.ts               `ITransporte`: un transporte (`emit(name, message)`/`listen(name, callback, signal)`), sin saber de componentes
│  │     └─ transportes/                `evento-dom.ts` (`TransporteEventoDom`: eventos del DOM sobre cualquier `EventTarget`, el mensaje viaja como `detail` de un `CustomEvent`) y `broadcast-channel.ts` (`TransporteBroadcastChannel`: entre pestañas del mismo origen; el `value` se clona; lo recibido lleva `origin` `remoto:<componente>`; no se puede cancelar)
│  ├─ navegador/apis/geolocation.ts   (`@mr/core-utils/apis/geolocation`): `requestGeolocation()` y `getLocation()` (coordenadas o `null`)
│  ├─ navegador/storages/cookies/   (`@mr/core-utils/navegador/storages/cookies/*`): `manager/` (CookieManager, tipos, expiraciones) y `services/` (base, legacycookieservice)
│  └─ unidades/
│     ├─ magnitudes/       las unidades en sí: enums, etiquetas, conversión y redondeo (`@mr/core-utils/unidades`)
│     │  ├─ index.ts          reexporta todo
│     │  ├─ velocidad.ts      TVelocidad, VelocidadUnidad, convertirVelocidad
│     │  ├─ precipitacion.ts  TPrecipitacion, PrecipitacionUnidad, convertirPrecipitacion, redondearPrecipitacion
│     │  ├─ nieve.ts          TNieve, NieveUnidad, convertirNieve, redondearNieve
│     │  ├─ presion.ts        TPresion, PresionUnidad, convertirPresion
│     │  ├─ temperatura.ts    TTemperatura, TemperaturaUnidad, convertirTemperatura
│     │  ├─ distancia.ts      TDistancia, DistanciaUnidad, convertirDistancia
│     │  └─ rayos.ts          TRayos (km2, mi2)
│     └─ portal/           uso de las unidades por un portal (`@mr/core-utils/unidades/portal`)
│        └─ index.ts          IUnidadesPortal, unidadesDefecto, UnidadesPortal<TId>
├─ README.md
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json
└─ tsconfig.json
```

## Superficie pública

### `src/config.ts` → `@mr/core-utils/config`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `IConfiguracion` | `interface` | Marca de tipo raíz; sin propiedades. Restricción de `T` en `Configuracion<T>`. |
| `Configuracion<T extends IConfiguracion>` | `class` | Almacena `defecto: T` y `user: Partial<T>` como propiedades `protected`. Base de toda la jerarquía de configuración del monorepo. |

#### Propiedades de `Configuracion<T>`

| Propiedad | Tipo | Visibilidad | Descripción |
|-----------|------|:-----------:|-------------|
| `defecto` | `T` | `protected` | Valores de configuración por defecto. |
| `user` | `Partial<T>` | `protected` | Sobreescrituras parciales del usuario. |

### `src/unidades/` → `@mr/core-utils/unidades` (y `@mr/core-utils/unidades/<magnitud>`; el uso por portal va aparte, en `@mr/core-utils/unidades/portal`)

Antes vivía en `services-comun/modules/utiles/unidades`; el patch **R036** migra los imports.
Sin dependencias: solo enums, tablas de etiquetas y funciones puras.

## Consumidores directos

| Paquete | Alias de importación |
|---------|---------------------|
| `@mr/core-workload/config` | `ConfigGenerico` / `IConfigGenerico` |
| `@mr/core-workload/config/google` | `Configuracion` / `IConfiguracion` |
| `@mr/core-network/server/http/routes/group` | `Configuracion` (solo tipo) |
| `www-base/modules/utiles/config` | `ConfigGenerico` / `IConfigGenerico` |
| `services-comun/modules/send-task-system/utiles/config` | `ConfigGenerico` / `IConfigGenerico` |

