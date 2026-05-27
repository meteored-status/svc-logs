# GitHub Copilot — Instrucciones del workspace `web-www`

Este workspace es un **monorepo** Node.js/TypeScript organizado en paquetes bajo `@mr/cli`, `@mr/core/`, `@mr/user/`, `framework`, `packages`, `cronjobs`, `jobs` y `services`.
Usa **Yarn workspaces** y **TypeScript** con paths absolutos entre paquetes.

> **Nota sobre este archivo:** la copia canónica de `copilot-instructions` vive en
> `@mr/core/dev/.github/copilot-instructions.md` y en la raíz del proyecto se expone
> mediante un **enlace simbólico del directorio** `.github`.
>
> Esto significa que cualquier archivo creado o editado dentro de `.github/` en la raíz
> realmente se crea/edita en `@mr/core/dev/.github/`. Debe mantenerse ese esquema.

---

## Paquete `@mr/cli`

**Ruta:** `@mr/cli/`
**Nombre npm:** `@mr/cli`

CLI del monorepo. Proporciona los ejecutables `mrpack` (ciclo de vida del proyecto: compilación,
despliegue, frameworks, init, update, upload, autodoc) y `mrlang` (internacionalización).
Consulta la documentación completa en [`@mr/cli/README.md`](../@mr/cli/README.md).

### Sub-módulos documentados

| Módulo | Documentación |
|--------|---------------|
| Manifest raíz (`mrpack.json` del monorepo) | [`manifest/README.md`](../@mr/cli/manifest/README.md) |

---

## Paquete `@mr/core-dev`

**Ruta:** `@mr/core/dev/`
**Nombre npm:** `@mr/core-dev`

Proporciona los tipos globales de entorno, las configuraciones TypeScript base y el modelo de manifiesto `mrpack.json`.
Consulta la documentación completa en [`@mr/core/dev/README.md`](../@mr/core/dev/README.md).

### Sub-módulos documentados

| Módulo                   | Documentación |
|--------------------------|---------------|
| Manifest (`mrpack.json`) | [`manifest/README.md`](../@mr/core/dev/manifest/README.md) |
| Bundler rspack           | [`bundler/rspack/README.md`](../@mr/core/dev/bundler/rspack/README.md) |
| Parches de migración     | [`patches/README.md`](../@mr/core/dev/patches/README.md) |

### Parches de migración

> Cuando se te indique **"aplica los patches"** o **"aplica los parches"**, ejecuta:
>
> ```bash
> yarn run patch:apply
> ```
>
> Para comprobar si hay cambios pendientes sin escribir en disco:
>
> ```bash
> yarn run patch
> ```
>
> Flujo completo recomendado tras `yarn mrpack update`:
>
> ```bash
> yarn mrpack update
> yarn run patch:apply
> ```
>
> Los shorthands del `package.json` raíz mapean a:
>
> | Shorthand | Comando completo |
> |-----------|-----------------|
> | `yarn run patch` | `yarn workspace @mr/core-dev mrpack:patch` |
> | `yarn run patch:apply` | `yarn workspace @mr/core-dev mrpack:patch:apply` |

---

## Paquete `@mr/core-i18n`

**Ruta:** `@mr/core/i18n/`
**Nombre npm:** `@mr/core-i18n`

Tipos y utilidades de internacionalización compartidos por todos los paquetes del monorepo.
Proporciona los tipos `Idioma`, `IdiomaCorto` e `IdiomaLargo`, la lista `soportados` y los helpers `soportado()` y `corto()`.
Consulta la documentación completa en [`@mr/core/i18n/README.md`](../@mr/core/i18n/README.md).

---

## Paquete `@mr/core-network`

**Ruta:** `@mr/core/network/`
**Nombre npm:** `@mr/core-network`

Proporciona las primitivas de red compartidas por todos los servicios del monorepo.
Consulta la documentación completa en [`@mr/core/network/README.md`](../@mr/core/network/README.md).

### Sub-módulos documentados

| Módulo | Documentación |
|--------|---------------|
| Cliente (resumen) | [`client/README.md`](../@mr/core/network/client/README.md) |
| Cliente HTTP | [`client/http/README.md`](../@mr/core/network/client/http/README.md) |
| Cliente WebSocket (`WSPool`, circuit breaker, streaming) | [`client/websocket/README.md`](../@mr/core/network/client/websocket/README.md) |
| Servidor (resumen) | [`server/README.md`](../@mr/core/network/server/README.md) |
| Servidor HTTP (router, handlers, i18n, favicon, admin) | [`server/http/README.md`](../@mr/core/network/server/http/README.md) |
| Servidor WebSocket (handlers, shutdown graceful, Datadog) | [`server/websocket/README.md`](../@mr/core/network/server/websocket/README.md) |
| Metadatos / protocolo (resumen) | [`metadata/README.md`](../@mr/core/network/metadata/README.md) |
| Protocolo WebSocket (mensajes, stream frames) | [`metadata/websocket/README.md`](../@mr/core/network/metadata/websocket/README.md) |

---

## Convenciones generales del monorepo

- **Gestor de paquetes:** `yarn` (no `npm`).
- **Lenguaje:** TypeScript estricto; sin `any` explícito salvo casos justificados.
- **Nomenclatura:** usar siempre `camelCase` para variables, parámetros, propiedades y funciones/métodos. Nunca usar `snake_case` ni `PascalCase` salvo para nombres de clases, interfaces, tipos, enums y componentes (que sí usan `PascalCase`).

  ```ts
  // ✅ Correcto
  const miVariable = 1;
  function calcularTotal(precioBase: number): number { ... }
  class MiServicio { ... }
  interface IConfigCliente { ... }

  // ❌ Incorrecto
  const mi_variable = 1;
  const MiVariable = 1;
  function calcular_total(precio_base: number): number { ... }
  ```

- **Líneas en blanco:** no debe haber dos líneas en blanco consecutivas en ningún fichero .ts ni .js.
- **Llaves en `if`/`else`/`for`/`while`:** siempre usar llaves, aunque el cuerpo sea de una sola línea.

  ```ts
  // ✅ Correcto
  if (condicion) {
      hacer();
  }

  // ❌ Incorrecto
  if (condicion) hacer();
  ```

- **Estructura de clases:** las propiedades y métodos se agrupan en dos bloques bien diferenciados, precedidos cada uno por un comentario de sección. Dentro de cada bloque, las propiedades y getters/setters van **antes** del constructor, y los métodos van después.

  ```ts
  class Ejemplo {
      /* STATIC */

      public static readonly instancias: Ejemplo[] = [];

      public static crear(): Ejemplo {
          return new Ejemplo();
      }

      /* INSTANCE */

      public readonly id: string;
      private activo: boolean;

      public get nombre(): string { return this._nombre; }
      public set nombre(v: string) { this._nombre = v; }

      public constructor() {
          this.id = "x";
          this.activo = false;
      }

      public activar(): void {
          this.activo = true;
      }
  }
  ```

  Si la clase no tiene miembros estáticos, se omite el bloque `/* STATIC */` y no es necesario el comentario `/* INSTANCE */`.
- **Imports:** usar siempre el nombre de paquete (`@mr/core-network/...`), nunca rutas relativas entre paquetes.
  Los imports se organizan en **tres bloques separados por una línea en blanco**, con el siguiente orden dentro de cada bloque:
  1. Imports con destructuring `{ }` primero, ordenados alfabéticamente por símbolo importado.
  2. Imports por defecto (sin llaves) a continuación, ordenados alfabéticamente por nombre del módulo, sin contar con los imports destructurados anteriores.

  **Bloque 1 — dependencias públicas y de Node.js** (`node:*`, `dd-trace`, `qs`, etc.)
  **Bloque 2 — dependencias de otros workspaces del monorepo** (`services-comun/...`, `@mr/otro-paquete/...`)
  **Bloque 3 — dependencias del propio workspace** (rutas relativas `./`, `../`)

  Usar siempre la keyword `type` cuando el import sea exclusivamente de un tipo TypeScript.

  ```ts
  // ✅ Correcto
  import {formats} from "dd-trace/ext";
  import tracer from "dd-trace";
  import crypto from "node:crypto";

  import {Deferred} from "services-comun/modules/utiles/promise";
  import {error, info} from "services-comun/modules/utiles/log";

  import type {IMessageClient, MessageServer} from "../message";
  import {Result} from "./result";

  // ❌ Incorrecto — bloques mezclados, sin type en imports de solo tipo
  import {Result} from "./result";
  import tracer from "dd-trace";
  import {IMessageClient} from "../message";
  ```
- **Promesas diferidas:** usar `Deferred<T>` de `services-comun/modules/utiles/promise`.
- **Logging:** usar `info`/`error` de `services-comun/modules/utiles/log`; evitar `console.log`.
- **Errores:** propagar siempre mediante Promise.reject o rechazo de `Deferred`; no silenciar salvo en callbacks de reposición del pool.
- **Inicialización de propiedades de clase:** las propiedades de instancia se inicializan siempre en el cuerpo del constructor, nunca en la declaración de la propiedad. Esto aplica tanto a propiedades primitivas como a objetos y arrays.

  ```ts
  // ✅ Correcto
  class Ejemplo {
      private readonly items: string[];
      private activo: boolean;

      public constructor() {
          this.items = [];
          this.activo = false;
      }
  }

  // ❌ Incorrecto — inicialización en la declaración
  class Ejemplo {
      private readonly items: string[] = [];
      private activo = false;
  }
  ```

- **Firmas de funciones y métodos:** todos los parámetros en la definición deben ir en **una sola línea** (sin saltos de línea dentro de `(...)`).

- **Parámetros opcionales o con valor por defecto:** en lugar de usar `?` o `=` directamente en parámetros posicionales, agruparlos en un **objeto de configuración** (último parámetro). Por defecto, desestructurarlo en la firma con sus defaults. Si la línea de la firma queda demasiado larga o el objeto tiene muchas propiedades, se permite mantener `config` en la firma y desestructurarlo al inicio de la función/método (en una o varias líneas) para mejorar la legibilidad.

  ```ts
  // ✅ Correcto
  interface IFooConfig {
      verbose?: boolean;
      retries?: number;
  }

  function foo(path: string, {verbose = false, retries = 3}: IFooConfig = {}): void {
      // ...
  }

  // ❌ Incorrecto
  function foo(path: string, verbose = false, retries = 3): void {
      // ...
  }
  ```

- **Sintaxis de tipos array:** usar siempre la forma `Tipo[]`, nunca `Array<Tipo>`.

  ```ts
  // ✅ Correcto
  const items: string[] = [];
  function foo(xs: number[]): boolean[] { ... }

  // ❌ Incorrecto
  const items: Array<string> = [];
  function foo(xs: Array<number>): Array<boolean> { ... }
  ```

- **Documentación de interfaces y enums:** la documentación de las propiedades/miembros se escribe en el bloque JSDoc del propio tipo, **no** como comentarios inline en cada declaración. Esto reduce el ruido visual dentro del cuerpo del tipo.

  ```ts
  // ✅ Correcto — propiedades documentadas en el bloque JSDoc
  /**
   * Configuración de conexión.
   *
   * @property host - Nombre de host o IP del servidor.
   * @property port - Puerto TCP. Por defecto 8080.
   * @property tls  - Si `true`, usa TLS/SSL.
   */
  interface IConfig {
      host: string;
      port?: number;
      tls?: boolean;
  }

  /**
   * Estado del circuito.
   *
   * - `Closed`   — funcionamiento normal.
   * - `Open`     — bloqueado; las peticiones fallan inmediatamente.
   * - `HalfOpen` — una petición de prueba puede pasar.
   */
  const enum CircuitState {
      Closed   = "closed",
      Open     = "open",
      HalfOpen = "half-open",
  }

  // ❌ Incorrecto — comentarios inline dentro del cuerpo
  interface IConfig {
      /** Nombre de host o IP. */
      host: string;
      /** Puerto TCP. */
      port?: number;
  }
  ```

- **`@returns` en métodos `Promise<void>`:** no es necesario documentar el valor de retorno en funciones o métodos cuyo tipo de retorno sea `Promise<void>` (o `void`), ya que se entiende que no devuelven ningún valor significativo. Omitir la etiqueta `@returns` en esos casos.

  ```ts
  // ✅ Correcto — sin @returns en Promise<void>
  /**
   * Persiste el manifest en disco.
   */
  public async save(): Promise<void> { ... }

  // ❌ Incorrecto — @returns innecesario
  /**
   * Persiste el manifest en disco.
   *
   * @returns Promesa que se resuelve sin valor cuando la escritura ha completado.
   */
  public async save(): Promise<void> { ... }
  ```

