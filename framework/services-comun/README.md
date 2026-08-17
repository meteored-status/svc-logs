# `services-comun`

Runtime legacy común del monorepo. Paquete de tipo **framework** (`packageManager` gestiona sus fuentes vía
`yarn mrpack framework`, sincronizadas con un bucket GCS): no se edita como código de negocio del proyecto
consumidor, cualquier cambio local se envía con `yarn mrpack framework --send`.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

---

## ⚠️ Nota sobre `AGENTS.md` / `main.ts`

`@mr/core/dev/AGENTS.md` (raíz del repo) afirma que "el ciclo de vida real (carga config, sidecar Istio,
master/worker, shutdown cronjob) vive en `framework/services-comun/main.ts`". **Ese fichero ya no existe.**

Se eliminó en el commit `578ed7e49` ("update") y su contenido (clase `Main`, `IMainConfig`, sondeo del
sidecar Istio `GET http://localhost:15020/healthz/ready`, `POST /quitquitquit`, ciclo
`Engine.build → engine.master() → engine.ejecutar()`) se migró íntegramente a
[`@mr/core-workload`](../../@mr/core/workload/README.md), que hoy es el punto de entrada real del ciclo de
vida (`Main.ejecutar(Engine, Configuracion)`), con cluster/worker añadido. Ver la sección
["Relación con `@mr/core-workload`"](#relación-con-mr-core-workload) más abajo para el detalle actual de
la relación entre ambos paquetes.

---

## Qué es este paquete

`services-comun` es la biblioteca de infraestructura y utilidades de negocio compartida por todos los
servicios Node del monorepo (`services/*`, y en repos hermanos también `cronjobs/*`/`jobs/*`): acceso a
bases de datos (MySQL, PostgreSQL, AlloyDB, Redis, ValKey), caché HTTP, Elasticsearch, mensajería (PubSub,
Eventarc), traducción/i18n de dominio, email transaccional (SparkPost), un sistema de envíos programados
(`send-task-system`) y decenas de utilidades (`modules/utiles/`) de bajo nivel (logging, promesas,
filesystem, hashing, unidades meteorológicas, etc.).

No define un servidor HTTP ni WebSocket propio (eso vive en `@mr/core-network`) ni el orquestador de
arranque (eso vive en `@mr/core-workload`); es la capa que ambos consumen para logging/fs/promesas/caché, y
que a su vez consume los tipos base de configuración y las clases `Engine` de `@mr/core-workload` para
construir engines especializados de negocio.

---

## Relación con `@mr/core-workload`

La relación es de **dependencia mutua tipada**, no de sustitución ni de jerarquía estricta:

- **`@mr/core-workload` → `services-comun`** (dependencia de implementación, no solo de tipos):
  `@mr/core-workload/index.ts` (`Main`), `engine/index.ts` (`Engine` base) y `engine/server.ts` (`Engine`
  HTTP) importan directamente `services-comun/modules/utiles/{log,fs,hash,random,promise}` y
  `services-comun/modules/net/cache{,/disk}` (`NetCache`, `NetCacheDisk`). Es decir: el orquestador
  genérico de arranque sigue apoyándose en las utilidades de bajo nivel de este paquete.
- **`services-comun` → `@mr/core-workload`** (mayormente tipos): `modules/engine_event.ts` y
  `modules/engine_server_task.ts` extienden las clases `Engine`/`Engine` HTTP de `@mr/core-workload` para
  ofrecer dos patrones de engine ya especializados (ver [Motor de ejecución](#motor-de-ejecución) abajo).
  Varios módulos de datos/servicio (`net/cache/{redis,valkey}`, `database/{redis,valkey}`, `status/*`,
  `send-task-system/data/dao/d-a-o-factory.ts`, `fs/storage.ts`) importan **solo como tipo** (`import
  type`) `Configuracion`, `IPodInfo` o `Google` desde `@mr/core-workload/config*` para tipar sus
  parámetros de configuración — no heredan de ellas.

En resumen: `@mr/core-workload` es el **orquestador de arranque genérico** (`Main`, `Engine`, `Engine`
HTTP, handlers `admin`/`error`/`favicon`); `services-comun` es la **biblioteca de infraestructura y
negocio** sobre la que se construyen engines concretos y que a su vez presta sus utilidades base al propio
orquestador. Un servicio real construye su engine así:

```ts
import {EngineServerTask} from "services-comun/modules/engine_server_task";
// o, para procesos sin servidor HTTP (workers de eventos/cronjobs):
import {EngineEvent} from "services-comun/modules/engine_event";

class MiEngine extends EngineServerTask<MiConfiguracion> {
    protected checkDatosDelay(): number { return 0; }
    protected async checkDatosEjecutar(): Promise<void> { /* ... */ }
}

// main.ts del servicio (patrón real, ver @mr/core-workload):
import {Main} from "@mr/core-workload";
Main.ejecutar(MiEngine, MiConfiguracion);
```

---

## Contenido

| Bloque | Entrada | Descripción |
|--------|---------|-------------|
| [Motor de ejecución](./CODEMAP.md#1-motor-de-ejecución-modules) | `services-comun/modules/{engine_event,engine_server_task}` | `EngineEvent`, `EngineServerTask` — especializaciones de `Engine`/`Engine` HTTP de `@mr/core-workload` |
| [Configuración Next.js](./CODEMAP.md#2-configuración-nextjs-raíz) | `services-comun/next.config.js` | Config base de Webpack/Next.js reutilizada por los servicios Next.js (`distDir`, `DefinePlugin` de constantes de entorno) |
| [Utilidades](./CODEMAP.md#3-utilidades-modulesutiles) | `services-comun/modules/utiles/*` | ~39 módulos de utilidades de bajo nivel: logging, promesas, fs, hashing, fechas, unidades meteorológicas, XML, kubectl, etc. |
| [Red / caché HTTP](./CODEMAP.md#4-red-modulesnet) | `services-comun/modules/net/*` | `NetCache`/`RequestCache` (abstractas) + implementaciones disco/memoria/Redis/ValKey; `BackendRequest`/`FrontendRequest` |
| [Base de datos](./modules/database/README.md) | `services-comun/modules/database/*` | Drivers MySQL/PostgreSQL/AlloyDB/Redis/ValKey, gestión de transacciones, *bulk* writers, `scroll`, `pagination`, `cloud-storage` — **README/CODEMAP propios** |
| [Sistema de envíos](./modules/send-task-system/README.md) | `services-comun/modules/send-task-system/*` | Sistema DAO de generación/envío/estadísticas de comunicaciones (SparkPost) — **README/CODEMAP propios** |
| [Mensajería](./CODEMAP.md#7-mensajería-modulesmessages) | `services-comun/modules/messages/*` | Cliente PubSub (v1 legacy y v2) + `EventarcPublisher` |
| [Elasticsearch](./CODEMAP.md#8-elasticsearch-moduleselasticsearch) | `services-comun/modules/elasticsearch/*` | Cliente `Elasticsearch` con failover multi-nodo + familias de `Bulk` writers |
| [Traducción](./CODEMAP.md#9-traducción-modulestraduccion) | `services-comun/modules/traduccion/*` | `Translation`/`TraduccionLiteral`/`TraduccionPlural`/`TraduccionMap` (v1 legacy) y su equivalente `v2/` |
| [Status](./CODEMAP.md#10-status-modulesstatus) | `services-comun/modules/status/*` | `Status` (RouteGroup de `/status/{workspace}/`) + cliente para reportar/leer specs y componentes a un servicio de status central |
| [Email](./CODEMAP.md#11-email-modulesemail) | `services-comun/modules/email/*` | `SparkPostManager` (`IMailManager`) + verificación de webhooks de SparkPost |
| [Módulos auxiliares](./CODEMAP.md#12-módulos-auxiliares) | `services-comun/modules/{cache,decorators,dependency-injection,algo,analytics,fs,google-calendar,google-elevation,hash,img,openapi,services,browser}` | Utilidades menores autocontenidas (una línea cada una, ver tabla) |

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.
