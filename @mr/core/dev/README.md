# `@mr/core-dev`

Paquete de infraestructura de desarrollo compartida por todos los workspaces del monorepo.
Proporciona los **tipos globales de entorno**, las **configuraciones TypeScript base** (Node y browser)
y el **modelo de manifiesto** (`mrpack.json`) que describe cómo se compila y despliega cada workspace.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Variables globales](#variables-globales-de-entorno) | `@mr/core-dev/types` | Tipos globales inyectados por el bundler (`PRODUCCION`, `ENTORNO`, …) |
| [tsconfig · Node](#tsconfig--node) | `@mr/core-dev/tsconfig.json` (condición `node`) | Configuración TypeScript para servicios Node.js |
| [tsconfig · Browser](#tsconfig--browser) | `@mr/core-dev/tsconfig.json` (condición `browser`) | Configuración TypeScript para bundles de navegador |
| [Manifest](#manifest-mrpackjson) | `@mr/core-dev/manifest` | Modelo de datos del archivo `mrpack.json` |
| [Bundler rspack](#bundler-rspack) | `bundler/rspack/rspack.config.ts` | Configuración rspack compartida por todos los workspaces |
| [Bundler esbuild](#bundler-esbuild) | `bundler/esbuild/esbuild.config.mjs` | Configuración esbuild compartida por todos los workspaces |
| [Topología Pub/Sub local](#topología-pubsub-local-mrpackpubsubts) | `@mr/core-dev/pubsub/*` | Declaración (`mrpack.pubsub.ts`) y alta en el emulador local de la topología de Pub/Sub de cada workspace |
| [Parches de migración](#parches-de-migración-mrpackpatch) | — | Autofix de imports deprecados; se aplica tras `yarn mrpack update` |
| [CONTRIBUTING.md](#contributingmd) | `CONTRIBUTING.md` | Convenciones de ramas (git-flow), versionado y despliegue (Cloud Build) del monorepo |
| [Hook CODEMAP/CHANGELOG](#hook-de-mantenimiento-codemapchangelog-claude-code) | `.claude/settings.json` | Hook `Stop` de Claude Code que fuerza mantener CODEMAP.md/CHANGELOG.md al día |

---

## Variables globales de entorno

**Entrada:** `@mr/core-dev/types`
**Fichero:** `types.d.ts`

Variables globales inyectadas en tiempo de compilación por el bundler (rspack/webpack). Disponibles
en cualquier workspace que extienda los tsconfigs de este paquete — los tsconfigs Node y Browser
incluyen `"types": ["@mr/core-dev"]`, de modo que no es necesario ningún `import` explícito.

Si el workspace usa un tsconfig propio que **no** extiende los de `@mr/core-dev`, añadir
manualmente:

```ts
import "@mr/core-dev/types"; // amplía el scope global; no exporta nada
```

o bien añadir `"@mr/core-dev"` al array `types` del tsconfig.

| Variable | Tipo | Descripción |
|----------|------|-------------|
| `PRODUCCION` | `boolean` | `true` cuando el bundle se compiló en **modo producción** (optimizado). Abarca los entornos de producción Y test; usar `TEST` para distinguirlos. |
| `TEST` | `boolean` | `true` únicamente en el entorno de **test/staging**. Solo puede ser `true` junto con `PRODUCCION=true`. |
| `DESARROLLO` | `boolean` | `true` cuando el bundle se compiló en **modo desarrollo** local. `PRODUCCION` y `TEST` son siempre `false` en este modo. |
| `NEXTJS` | `boolean` | `true` cuando el código se ejecuta dentro de un runtime Next.js. |
| `ENTORNO` | `string` | Nombre del entorno activo (`"produccion"`, `"test"`, `"desarrollo"`, …). |
| `DATABASE` | `string \| undefined` | Nombre de la base de datos MySQL activa. `undefined` si el workspace no usa BD. |

### Combinaciones válidas

| Entorno real | `PRODUCCION` | `TEST` | `DESARROLLO` |
|---|:---:|:---:|:---:|
| Producción | `true` | `false` | `false` |
| Test / staging | `true` | `true` | `false` |
| Desarrollo local | `false` | `false` | `true` |

### Uso

```ts
if (PRODUCCION) {
    // código exclusivo de producción
}

if (DATABASE !== undefined) {
    // el workspace tiene base de datos configurada
}
```

> Las variables son **reemplazadas por literales** en el bundle final (tree-shaking total).
> No existen en runtime: el bundler sustituye cada referencia por su valor booleano/string.

---

## tsconfig · Node

**Entrada:** `@mr/core-dev/tsconfig.json` (condición de exportación `node`)
**Fichero:** `tsconfig/node.json`

Configuración base para todos los servicios Node.js del monorepo. Extiende
`@tsconfig/node24/tsconfig.json` con las siguientes opciones adicionales:

| Opción | Valor | Notas |
|--------|-------|-------|
| `module` | `"preserve"` | Conserva `import`/`export` para el bundler |
| `moduleResolution` | `"bundler"` | Resolución optimizada para rspack/webpack |
| `lib` | `["es2023", "esnext.disposable", "dom"]` | Incluye DOM para acceso a `WebSocket`, `fetch`, etc. |
| `types` | `["node"]` | Solo tipos de Node; los tipos de navegador vienen de `lib` |
| `jsx` | `"react"` | Permite JSX en ficheros `.tsx` |
| `strictNullChecks` | `true` | |
| `noImplicitOverride` | `true` | |
| `noImplicitReturns` | `true` | |
| `noPropertyAccessFromIndexSignature` | `true` | |
| `incremental` | `true` | Compilaciones incrementales con `.tsbuildinfo` |
| `removeComments` | `true` | Se eliminan comentarios en el output |
| `sourceMap` | `true` | |

```jsonc
// tsconfig.json de cualquier servicio Node
{
    "extends": "@mr/core-dev/tsconfig.json"  // resuelve a tsconfig/node.json
}
```

### Sin `exclude`, a propósito

`tsconfig/node.json` **no declara `exclude`**, y no debe volver a declararlo: un tsconfig base no puede
expresar exclusiones que sirvan a quien lo extiende. TypeScript resuelve las rutas relativas heredadas
contra el fichero que las declara, así que un `"**/*.spec.ts"` escrito aquí apunta a
`@mr/core/dev/tsconfig/` y no al workspace que hereda —comprobado con `tsc --showConfig` desde
`status-frontend`: los cuatro patrones que había (`node_modules`, `**/*.spec.ts`, `output/*`,
`output/**/*`) resolvían a `../../@mr/core/dev/tsconfig/…` y no excluían nada—.

Y salía **peor que no poner nada**: al estar la clave presente, TypeScript no aplica sus exclusiones por
defecto (`node_modules`, `bower_components`, `jspm_packages` y el `outDir`), de modo que cada workspace se
quedaba con cuatro rutas muertas en vez de con las buenas. Sin la clave, cada workspace recibe las de
TypeScript y puede añadir las suyas —relativas a su propio tsconfig, que es donde funcionan—.

---

## tsconfig · Browser

**Entrada:** `@mr/core-dev/tsconfig.json` (condición de exportación `browser`)
**Fichero:** `tsconfig/browser.json`

Configuración base para bundles de navegador. Extiende `@tsconfig/recommended` con:

| Opción | Valor | Notas |
|--------|-------|-------|
| `target` | `"es2015"` | Compatibilidad amplia |
| `module` | `"esnext"` | |
| `moduleResolution` | `"bundler"` | |
| `lib` | `["es2015", "dom"]` | |
| `allowJs` | `true` | Permite mezclar JS y TS |
| `downlevelIteration` | `true` | Iteradores correctos en ES2015 |
| `removeComments` | `false` | Se conservan comentarios (licencias, etc.) |
| `strictNullChecks` | `true` | |
| `noImplicitAny` | `true` | |
| `sourceMap` | `true` | |

---

## Manifest (`mrpack.json`)

**Entradas:** `@mr/core-dev/manifest` y subpaths
**Ficheros:** `manifest/`
**Documentación completa:** [`manifest/README.md`](./manifest/README.md)
**Código fuente:** [`manifest/CODEMAP.md`](./manifest/CODEMAP.md) — mapa de clases, interfaces y jerarquía de composición

El modelo de datos que describe cómo se compila y despliega cada workspace del monorepo.
Cada workspace que produce una build debe incluir un archivo `mrpack.json` en su raíz.

```ts
import type {IManifest} from "@mr/core-dev/manifest";
import {Manifest} from "@mr/core-dev/manifest";

const manifest = new Manifest(JSON.parse(fs.readFileSync("mrpack.json", "utf8")));
```

### Subpaths disponibles

| Import | Contenido |
|--------|-----------|
| `@mr/core-dev/manifest` | `Manifest`, `IManifest` |
| `@mr/core-dev/manifest/root` | `ManifestRoot<T>` — clase base abstracta |
| `@mr/core-dev/manifest/build` | `ManifestBuild`, `IManifestBuild`, `BuildFW`, `BuildBundler` |
| `@mr/core-dev/manifest/build/bundle` | `ManifestBuildBundle`, `IManifestBuildBundle` |
| `@mr/core-dev/manifest/build/bundle/base` | `ManifestBuildBundleBase`, `IManifestBuildBundleBase` |
| `@mr/core-dev/manifest/build/bundle/componentes` | `ManifestBuildComponentes`, `ManifestBuildComponentesCSS` |
| `@mr/core-dev/manifest/build/database` | `ManifestBuildDatabase`, `IManifestBuildDatabase` |
| `@mr/core-dev/manifest/deployment` | `ManifestDeployment`, `IManifestDeployment`, `Runtime`, `Target`, `ManifestDeploymentKind` |
| `@mr/core-dev/manifest/deployment/credenciales` | `ManifestDeploymentCredenciales`, `IManifestDeploymentCredenciales` |
| `@mr/core-dev/manifest/deployment/imagen` | `ManifestDeploymentImagen`, `IManifestDeploymentImagen` |
| `@mr/core-dev/manifest/deployment/imagen/entorno` | `ManifestDeploymentImagenEntorno`, `IManifestDeploymentImagenEntorno` |
| `@mr/core-dev/manifest/deployment/kustomize` | `ManifestDeploymentKustomize`, `IManifestDeploymentKustomize` |
| `@mr/core-dev/manifest/deployment/storage` | `ManifestDeploymentStorage`, `IManifestDeploymentStorage` |
| `@mr/core-dev/manifest/deployment/storage/buckets` | `ManifestDeploymentStorageBuckets`, `IManifestDeploymentStorageBuckets` |
| `@mr/core-dev/manifest/development` | `ManifestDevelopment`, `IManifestDevelopment` |


---

## Bundler rspack

**Ficheros:** `bundler/rspack/`
**Documentación completa:** [`bundler/rspack/README.md`](./bundler/rspack/README.md)
**Código fuente:** [`bundler/rspack/CODEMAP.md`](./bundler/rspack/CODEMAP.md) — entry point, ensamblador, todos los módulos (entry/output/devtool/module/plugins/externals/optimization/target) y flujo completo

Módulo que genera la configuración de rspack para todos los workspaces del monorepo.
Cada workspace solo necesita un `rspack.config.ts` que re-exporte la función de entrada:

```ts
// rspack.config.ts de cualquier workspace
export {default} from "@mr/core-dev/bundler/rspack/rspack.config";
```

### Arquitectura

| Fichero | Exportación | Responsabilidad |
|---------|-------------|-----------------|
| `rspack.config.ts` | `default(env)` | Punto de entrada; lee `mrpack.json` y `package.json` y devuelve el array de configuraciones |
| `configuracion.ts` | `default(config)` | Ensambla una `Configuration` completa de rspack para un bundle individual |
| `devtool.ts` | `Devtool(runtime, entornos, entorno)` | Calcula el valor de `devtool` (source maps) |
| `entry.ts` | `Entry(runtime, framework, config)` | Calcula los puntos de entrada según runtime y framework |
| `externals.ts` | `Externals(runtime, deps)` | Marca las dependencias como externas (solo Node) |
| `module.ts` | `Module(config)` | Configura los loaders (TS, CSS, SCSS, Pug, imágenes) |
| `optimization.ts` | `Optimization(runtime, desarrollo)` | Configura minificación y `splitChunks` |
| `output.ts` | `Output.build(runtime, config)` | Calcula el directorio y formato de los ficheros de salida |
| `plugins.ts` | `default(runtime, framework, config)` | Genera el array de plugins (`DefinePlugin`, `CssExtract`, `TsChecker`, `Manifest`) |
| `target.ts` | `Target(runtime)` | Devuelve el valor de `target` de rspack |

### Flujo de compilación

```
rspack.config.ts
  └─ configuracion()        ← un bundle por runtime declarado en mrpack.json
       ├─ Entry()           ← puntos de entrada
       ├─ Output.build()    ← directorio y nombres de fichero de salida
       ├─ Module()          ← loaders TypeScript/CSS/SCSS/Pug
       ├─ Optimization()    ← minificación y splitChunks
       ├─ Externals()       ← dependencias externas (solo Node)
       ├─ Devtool()         ← source maps
       ├─ Target()          ← plataforma destino
       └─ plugins()         ← DefinePlugin + CssExtract + TsChecker + Manifest
```

---

## Bundler esbuild

**Ficheros:** `bundler/esbuild/`
**Documentación completa:** [`bundler/esbuild/README.md`](./bundler/esbuild/README.md)
**Código fuente:** [`bundler/esbuild/CODEMAP.md`](./bundler/esbuild/CODEMAP.md) — entry point, parseo de `--env`, normalización de `mrpack.json` y flujo build/watch

Módulo que genera la configuración de esbuild para workspaces del monorepo.
Versión Node-only:

- solo compila cuando `deploy.runtime === "node"`,
- no compila workspaces `build.framework === "nextjs"`,
- build única `app -> main.ts`,
- inyección de globales (`DESARROLLO`, `TEST`, `PRODUCCION`, `ENTORNO`, `NEXTJS`, `DATABASE`) con `getDefine()`, que vive
  en `bundler/esbuild/define.mjs` porque `esbuild.config.mjs` compila al importarse y `pubsub/evaluar.mjs` necesita los mismos
  `define` sin lanzar ningún build,
- watch en desarrollo y build única en `test/produccion`.

---

## Topología Pub/Sub local (`mrpack.pubsub.ts`)

**Ficheros:** `pubsub/` · **Código fuente:** [`CODEMAP.md`](./CODEMAP.md#9-topología-pubsub-local--pubsub)

El emulador local de Pub/Sub (docker `pubsub` de mrenv, `localhost:8085`, proyecto `meteored-local`) arranca vacío. Cada
workspace declara en un `mrpack.pubsub.ts`, en su raíz, los topics que publica y las suscripciones que consume; `mrpack`
(`yarn mrpack pubsub`, `yarn mrpack devel -p`) los lee todos, los fusiona y da de alta la topología resultante en el emulador
por REST. No hay una lista central que mantener ni puertos escritos a mano.

### Formato

```ts
// services/amateur-background/mrpack.pubsub.ts
import {definirPubSub} from "@mr/core-dev/pubsub/declaracion";
import {EService, SERVICES} from "services-comun-meteored/modules/services/config";

import {TOPIC_TAREAS} from "amateur-base/modules/utiles/pubsub-nombres";

export default definirPubSub({
    suscripciones: [{
        nombre: `${TOPIC_TAREAS}-local`,
        topic: TOPIC_TAREAS,
        push: {base: SERVICES.servicio(EService.amateur_background).base, ruta: "/"},
        ackDeadline: 600,
    }],
});
```

| Clave | Dónde | Significado |
|-------|-------|-------------|
| `topics` | declaración | Topics que publica el workspace. |
| `suscripciones[].nombre` / `.topic` | suscripción | Nombre de la suscripción y del topic del que cuelga. |
| `suscripciones[].filtro` | suscripción | Filtro de Pub/Sub sobre atributos (`attributes.sender = "amateur"`). Si no hay, se omite: no puede ser una cadena vacía. |
| `suscripciones[].push` | suscripción | `{base, ruta?}`: entrega push. Sin `push`, la suscripción es pull. |
| `suscripciones[].ackDeadline` | suscripción | Entero entre 10 y 600. Por defecto, 10 (el del emulador). |

`definirPubSub` valida al evaluarse el fichero: **una clave desconocida es un error** (`topic` por `topics` se ignoraría en
silencio y la topología quedaría incompleta), igual que un nombre que no sea un nombre válido de recurso de Pub/Sub
(`[A-Za-z][A-Za-z0-9-_.~+%]{2,254}`, sin empezar por `goog`), un `filtro` vacío, un `push.base` que no sea una URL
`http`/`https` con puerto explícito, una `push.ruta` que no empiece por `/`, un `ackDeadline` fuera de rango y los nombres repetidos
dentro de una declaración.

### Quién declara qué

| Recurso | Lo declara | Por qué |
|---------|------------|---------|
| Topic | El workspace donde está el código que **publica** (puede ser un package). | Varios publicadores del mismo topic son válidos: es solo `declaradoPor` con varios workspaces. |
| Suscripción | El workspace que la **consume**. | Cada suscripción tiene un único consumidor: dos workspaces con la misma suscripción es un error de `fusionar`. |
| Push | El servicio que lo **recibe**, apuntando a sí mismo. | `push.base` sale de `SERVICES.servicio(EService.<servicio>).base`. |

Un topic que solo aparece en una suscripción (el topic es de otro repo, o lo publica algo que no es de este monorepo) no se
declara: se **deduce** de la suscripción y se crea igualmente (`ITopicTopologia.deducido`).

### Los nombres y los puertos se importan, no se escriben

Un `mrpack.pubsub.ts` no repite literales: importa las mismas constantes que usa el código (`TOPIC`,
`SUBSCRIPTION(ESubscription.X)` de `@mr/core-ai/pub-sub/pub-sub`, el nombre de topic de un módulo propio) y calcula los puertos con
`SERVICES.servicio(EService.x).base`. Así, cambiar un nombre en el código cambia la topología sin tocar nada más. Si el nombre
depende del entorno (`DESARROLLO ? … : …`) se importa tal cual: se evalúa con `DESARROLLO=true`.

**Solo se pueden importar módulos de constantes sin efectos secundarios.** La declaración se ejecuta para leerla, y un módulo que
crea clientes (Pub/Sub, bases de datos), lee ficheros o abre conexiones al importarse lo haría también ahí. El workspace necesita
`@mr/core-dev` en `devDependencies` (y `yarn install`) para poder importar `definirPubSub`.

**Dónde van los nombres: convención fija, igual en todos los repos.**

```text
modules/utiles/pubsub/
├─ nombres.ts   — solo las constantes de nombres de topics y suscripciones de ESTE workspace; no importa nada salvo `import type`
└─ index.ts     — los clientes (`PubSub.build(...)`), que importan sus nombres de `./nombres`
```

Las declaraciones, el cliente y los tests importan de `utiles/pubsub/nombres`. Lo que ya da un framework (`TOPIC`,
`SUBSCRIPTION(ESubscription.X)`) se importa de allí, y lo que no es de Pub/Sub, aunque salga en un filtro (el cliente ante la IA, por
ejemplo), se queda en su módulo. No se crean ficheros sueltos en `utiles/` para esto. La lista de comprobación al declarar (un fichero
por cada consumidor, filtros por atributo, nombres reales de GCP) está en la sección «Pub/Sub: topología local» de
`.github/copilot-instructions.md`.

### Cómo se evalúa

`pubsub/evaluar.mjs` empaqueta cada `mrpack.pubsub.ts` con esbuild (`bundle`, `platform: "node"`, `format: "cjs"`, `target: "node24"`,
sin `external`) usando los `define` del build de desarrollo (`getDefine({entorno: "desarrollo", database})`, con `build.database.test` del `mrpack.json` del
workspace como `DATABASE`, igual que `esbuild.config.mjs`), lo ejecuta en su propio proceso y
escribe las declaraciones como JSON. Como se empaqueta todo, resuelve imports de otros workspaces y de PnP igual que el build del
servicio, y solo quedan como `require` los módulos de Node.

```bash
# desde cualquier sitio; <raiz> tiene que ser absoluta (yarn workspace cambia el directorio de trabajo)
yarn workspace @mr/core-dev node pubsub/evaluar.mjs <raiz> services/amateur packages/amateur-base
```

```json
{"declaraciones": [{"workspace": "services/amateur", "declaracion": {"suscripciones": [{"nombre": "…", "topic": "…"}]}}]}
```

- `declaraciones` va en el orden recibido; `workspace` es la ruta relativa a la raíz y `declaracion` lo que exporta el fichero
  (`default`, o el módulo entero si no hay `default`).
- Si alguna declaración no compila, lanza al evaluarse o no exporta un objeto, **no se escribe nada en stdout**: cada fallo va a
  stderr como `<workspace>: <mensaje>` y el código de salida es 1. Se evalúan todas aunque una falle, para dar todos los errores de una vez.
  El mensaje de un error de esbuild lleva sus `notes`, y si no resuelve `@mr/core-dev/...` añade la pista de que el workspace necesita
  `@mr/core-dev` en `devDependencies` (y `yarn install`).
- stdout queda reservado para el JSON: mientras se evalúan las declaraciones, `console.log`/`info`/`debug` escriben en stderr.

`buscarDeclaraciones(raiz)` (`pubsub/descubrir.ts`) dice qué workspaces tienen declaración: lee `workspaces` del `package.json` raíz,
expande los patrones (`dir/*`, `@mr/core/*`, `services-*`, rutas exactas, `!exclusión`) y devuelve los que tienen `package.json` y
`mrpack.pubsub.ts`, estén habilitados o no en `config.workspaces.json`. `fusionar(declaraciones)` las une en una `ITopologia`.

### Qué hace `EmuladorPubSub`

Cliente REST del emulador (`pubsub/emulador.ts`; solo `fetch`, ninguna librería de Google). **No escribe en el log**: devuelve
informes y los muestra quien llama. **Nunca toca un recurso que no esté en la topología que recibe**, salvo `limpiar`, que solo
borra lo que lleva la label de este repo.

| Método | Qué hace |
|--------|----------|
| `disponible()` | `GET /` devuelve `Ok`. Si no, quien llama muestra `mensajeEmuladorCaido(host)` y no arranca nada. |
| `aplicar(topologia, {modo, repo})` | Da de alta la topología (ver la tabla de modos). Idempotente. |
| `estado(topologia, {repo})` | Por recurso declarado: `ok`, `falta` o `difiere` (con el detalle); y los `extras` que hay en el emulador y no están declarados, con su dueño. No escribe. |
| `purgar(suscripciones, {repo})` | `DELETE` + `PUT` de las suscripciones indicadas con su configuración declarada: descarta sus mensajes pendientes. Un 409 en el `PUT` (otro proceso ya la recreó, vacía) se da por bueno. |
| `limpiar(topologia, {repo})` | Borra las suscripciones de este repo que ya no se declaran y los topics de este repo que ya no se declaran y no tienen suscripciones. |
| `publicar(topic, mensaje, attributes?)` | Publica un JSON (base64) y devuelve el `messageId`. Lo usan los tests e2e. |
| `listar()` | Todo lo que hay en el emulador, con paginación. |
| `entorno` | `{PUBSUB_EMULATOR_HOST, PUBSUB_PROJECT_ID}`: lo que `mrpack devel -p` inyecta en los procesos que lanza. |

`aplicar` según el modo, con lo que ya existe y difiere de la declaración (`compararSuscripcion`):

| Situación | `arranque` | `vigilancia` |
|-----------|------------|--------------|
| Topic o suscripción que falta | Se crea (`creado`) | Se crea |
| Existe y es igual | `existia` | `existia` |
| Solo difiere el endpoint push | `modifyPushConfig` (`push-actualizado`) | `difiere`, sin tocarla |
| Difiere el topic, el filtro o el `ackDeadline` | `DELETE` + `PUT` (`recreado`; pierde sus mensajes pendientes) | `difiere`, sin tocarla |
| Difiere y lleva la label `mrpack-repo` de **otro** repo | `difiere` («declarada también por el repo X: …»), sin tocarla | `difiere`, con el mismo detalle |
| El `PUT` responde 409 (otro proceso la creó entre medias: dos `devel -p` a la vez, `pubsub -r` con una vigilancia en marcha) | Se vuelve a leer y se compara, sin recrearla: `existia` si es igual, `difiere` si no | Igual |

`arranque` es el modo normal. `vigilancia` es para cuando los servicios ya están en marcha: recrear una suscripción les quitaría los mensajes en vuelo, así que solo se completa lo que falta. Para `compararSuscripcion`
son iguales un filtro vacío y uno ausente, un endpoint vacío y uno ausente, y un `ackDeadline` sin declarar y el 10 por defecto del
emulador. El endpoint push se calcula con `endpointPush`: protocolo y puerto de `push.base`, host `pushHost` (el emulador corre en un
docker y para él `localhost` es el propio contenedor) y la ruta.

**Labels y «dueño».** Cada topic y suscripción que se crea lleva `mrpack-repo` (el repo, saneado: minúsculas, solo `[a-z0-9_-]`, 63 como
máximo, `/` → `_`) y `mrpack-workspace` (quién lo declara). Los topics **deducidos** (nadie los declara en `topics`: solo cuelgan de una
suscripción) se crean **sin labels**: pueden ser de otro repo, y así `limpiar` de este nunca los borra (a cambio, nadie los limpia).
Los nombres van codificados con `encodeURIComponent` en las rutas REST. Medido contra el emulador de mrenv, **conserva
las labels** de topics y suscripciones en `GET` y en el listado, de modo que `estado` puede decir de quién es cada extra y `limpiar` sabe qué
es suyo. Lo que existía antes sin label (creado a mano o con otra herramienta) no tiene dueño: `mrpack` no lo toca nunca.

### Configuración del emulador

`resolverConfigEmulador({env, fichero})` decide los datos de conexión, por orden de precedencia: variable de entorno
(`PUBSUB_EMULATOR_HOST`, `PUBSUB_PROJECT_ID`, `MRPACK_PUBSUB_PUSH_HOST`), bloque opcional `pubsub` de `config.workspaces.json`
(`{"pubsub": {"host", "proyecto", "pushHost"}}`, lo lee `leerConfigEmulador(raiz)`) y valores por defecto
(`localhost:8085`, `meteored-local`, `host.docker.internal`). Una cadena vacía cuenta como ausente.

Las variables `PUBSUB_EMULATOR_HOST` y `PUBSUB_PROJECT_ID` **no se escriben en código ni en ficheros versionados**: solo las inyecta
`mrpack devel -p` en los procesos que lanza, y `Main` de `@mr/core-workload` aborta el arranque si están definidas en un bundle de test o producción.

### Pruebas

`yarn workspace @mr/core-dev test` (`spec/pubsub.spec.ts`, `node:test`). Compila con `tsconfig.spec.json` a `tmp/spec` como módulos ES
(`@mr/core-dev` es `"type": "module"`; `rewriteRelativeImportExtensions` convierte los `.ts` de los imports en `.js` al emitir). Cubre la
validación, la fusión, `endpointPush`, `puertoPush`, `compararSuscripcion`, la configuración, el descubrimiento de workspaces y `EmuladorPubSub`
contra un emulador en memoria (sin red ni docker).

---

## Parches de migración (`mrpack:patch:apply`)

**Ficheros:** `patches/`
**Documentación completa:** [`patches/README.md`](./patches/README.md)
**Código fuente:** [`patches/CODEMAP.md`](./patches/CODEMAP.md) — runner, factorías, tabla de reglas R001–R020 y WS001

> **Para agentes de IA:** cuando se te indique **"aplica los parches"**, ejecuta:
>
> ```bash
> yarn run patch:apply
> ```

El sistema de parches automatiza cambios repetitivos sobre todo el monorepo (sustitución
de imports deprecados, wrappers legacy, etc.).

`yarn run patch:apply` se ejecuta **automáticamente** después de instalar, actualizar
o resetear frameworks mediante `yarn mrpack framework` o `yarn mrpack update`, por lo
que normalmente no es necesario invocarlo a mano. La salida se muestra en consola en
tiempo real durante su ejecución.

| Comando | Descripción |
|---------|-------------|
| `yarn run patch:apply` | Aplica todos los parches activos (incremental desde el último aplicado) |

Los shorthands del `package.json` raíz mapean a:

| Shorthand | Comando completo |
|-----------|-----------------|
| `yarn run patch:apply` | `yarn workspace @mr/core-dev mrpack:patch:apply` |

---

## CONTRIBUTING.md

**Fichero:** `CONTRIBUTING.md`
**Expuesto en la raíz de cada monorepo consumidor** mediante symlink (`initContributing()`,
mismo patrón que `AGENTS.md`/`CLAUDE.md` — ver `@mr/cli/src/clases/init/symlinks.ts`).

Documenta las convenciones de ramas (git-flow del monorepo: `master`/`main`, `develop`,
`hotfix/<nombre>`, `feature/<fecha>_<nombre>_<ticket>_<desc>`, `version/<desarrollador>`),
versionado (paquetes de negocio vs. de framework) y despliegue (Google Cloud Build
disparado por push a `develop`/`feature/test`/`master`).

Enlazado desde `CLAUDE.md` (import `@CONTRIBUTING.md`) y desde
`.github/copilot-instructions.md`, ambos resueltos desde la raíz del repo consumidor.

---

## Hook de mantenimiento CODEMAP/CHANGELOG (Claude Code)

**Ficheros:** `.claude/`
**Código fuente:** [`.claude/CODEMAP.md`](./.claude/CODEMAP.md) — flujo completo del script del hook

Hook `Stop` de Claude Code que hace cumplir de forma determinista la convención de
"Mantenimiento de CODEMAPs" (ver `.github/copilot-instructions.md`/`AGENTS.md`): al terminar un
turno con cambios en el working tree, agrupa los ficheros de código modificados por workspace
(directorio con `package.json` más cercano, excluyendo la raíz del monorepo) y bloquea una vez
si algún workspace con cambios significativos (fichero nuevo, o ≥ 15 líneas modificadas) no
tocó su `CODEMAP.md` — o su `CHANGELOG.md`, si ya existía.

- Todo `.claude/` se symlinkea entero en la raíz de cada monorepo consumidor mediante
  `initClaudeDir()` (`@mr/cli/src/clases/init/symlinks.ts`), igual que `.github/`
  (junction en Windows, symlink relativo en Unix) — a diferencia de `AGENTS.md`/`CLAUDE.md`,
  que son symlinks de fichero simple. `.claude/settings.local.json` (local) se excluye tanto
  del envío del framework (`.claude/.mr-ignore`) como del `.gitignore` raíz de cada monorepo
  consumidor (`**/.claude/settings.local.json` en la plantilla `IGNORE` de `@mr/cli`); si ya
  existía como fichero real antes de tener este framework, `initClaudeDir()` lo migra primero a
  `@mr/core/dev/.claude/` para no perderlo.
- `.claude/settings.json` — declara el hook.
- `.claude/hooks/check-codemap.mjs` — Node ESM plano sin dependencias, invocado siempre como
  `node check-codemap.mjs` (el bit ejecutable es irrelevante).

Solo analiza cambios sin comitear, y por el guardrail `stop_hook_active` de Claude Code el
bloqueo ocurre como máximo una vez por intento de parada (evita bucles infinitos).

## Confirmación de los subagentes caros

Los dos modelos caros (Opus y Fable) piden confirmación antes de invocarse. Ya está puesto en
`.claude/settings.json`, no hay que añadirlo:

```json
{
  "permissions": {
    "ask": [
      "Agent(opus-planner)",
      "Agent(fable-architect)",
      "Agent(model:opus)",
      "Agent(model:fable)"
    ]
  }
}
```

`permissions.ask` es la clave correcta en `.claude/settings.json` para reglas que piden
confirmación antes de ejecutar (a diferencia de `permissions.allow`/`permissions.deny`, que
permiten o bloquean sin preguntar). Las reglas que hacen el trabajo son
[`Agent(<nombre-del-subagente>)`](https://code.claude.com/docs/en/permissions#agent-subagents), que
es la forma documentada de nombrar un subagente.

Las de `model` no bastan por sí solas: `Tool(param:valor)` casa contra **un parámetro de la
llamada**, no contra la configuración del subagente, y
[un parámetro que la llamada omite no casa nunca](https://code.claude.com/docs/en/permissions#match-by-input-parameter).
Como el modelo de un subagente lo fija el `model:` de su frontmatter, al despachar por nombre el
parámetro `model` no viaja y esa regla no se dispara. Se mantienen las dos para cubrir un override
explícito de modelo en la llamada. Las llamadas a `sonnet-builder` siguen sin interrupciones.

La documentación solo ilustra `Agent(<nombre>)` en `deny`; si alguna vez deja de pedir confirmación,
míralo con `/permissions` desde una sesión interactiva de `claude` en terminal, que lista las reglas
en efecto y de qué `settings.json` sale cada una. No esperes que te avise nada por tu cuenta: el
aviso de arranque solo comprueba **el nombre de la herramienta**, y `Agent` es conocida, así que una
regla que apunte a un subagente inexistente o mal escrito no salta — que es justo el fallo que
querrías cazar. Y `claude --verbose` enseña los parámetros de cada llamada.

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.
