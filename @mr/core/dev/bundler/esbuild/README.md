# `@mr/core-dev` — Bundler esbuild

Configuración compartida de **[esbuild](https://esbuild.github.io/)** para workspaces del monorepo.

---

## Fichero principal

```txt
bundler/esbuild/esbuild.config.mjs
```

---

## Flujo de compilación

1. Lee `package.json` y `mrpack.json` del workspace recibido en `--env dir=<path>`.
2. Solo compila si `deploy.runtime` es `node` y `build.framework` no es `nextjs`.
3. Genera una única build Node (`app -> main.ts`).
4. Ejecuta `tsc --noEmit` en paralelo a esbuild (equivalente al type-check de rspack).
5. En watch (activado explícitamente con `--watch`, independientemente del `entorno`) lanza también `tsc --watch`.
6. Sin `--watch` (incluido `entorno=desarrollo`) limpia `output/` y compila una única vez.

> **Resolución de `tscBin`:** el binario de `tsc` se localiza componiendo la ruta a partir
> de `typescript/package.json` (`require.resolve("typescript/package.json")` +
> `bin/tsc`), en lugar de `require.resolve("typescript/bin/tsc")`. Este último subpath dejó
> de estar expuesto en el campo `exports` del `package.json` de TypeScript 7, por lo que
> fallaba con `ERR_PACKAGE_PATH_NOT_EXPORTED`.
>
> **Versión de `typescript` fijada en `^6.x`:** TypeScript 7 (compilador nativo en Go,
> "Corsa"/`tsgo`) todavía no soporta resolución de módulos bajo Yarn PnP (ver
> [microsoft/typescript-go#460](https://github.com/microsoft/typescript-go/issues/460) y el
> PR [#1966](https://github.com/microsoft/typescript-go/pull/1966), sin fusionar). Con TS7,
> `tsc --noEmit`/`--watch` no encuentra ningún módulo de workspace (`services-comun/...`,
> `@mr/core-*`, etc.), aunque esbuild sí compila correctamente. No actualizar a `^7.x` hasta
> que ese soporte se publique en una versión estable.

---

## Externals: `dependencies` decide qué se empaqueta y qué no

```js
external: Object.keys(dependencies ?? {}),
```

**La lista de `dependencies` del `package.json` del workspace ES su lista de externals.** No hay
lista aparte ni configuración por servicio: lo que está declarado se deja como `require()` en el
bundle y tiene que existir en `node_modules` al arrancar; lo que no está declarado, esbuild lo
**empaqueta dentro** de `output/app.js`.

Esto convierte `dependencies` en una decisión de build y no en metadatos, y tiene tres
consecuencias que conviene tener presentes:

| Situación | Qué pasa |
|-----------|----------|
| Declarada y usada | Queda `require()`. Es el caso normal. |
| Declarada y **no** usada | No pasa nada en el bundle. La imagen desplegada instala un paquete que nadie pide. |
| **No** declarada y usada | Se empaqueta dentro del `app.js`. Funciona, pero engorda el bundle — medido en `svc-status`: `sparkpost` sin declarar añadía **1,6 MB**. |

Corolario práctico: cuando un servicio empieza a usar una librería **a través de un framework**
(`services-comun`, `@mr/core-*`), hay que declararla también en el servicio. Los frameworks tienen
todas sus dependencias en `devDependencies` —se empaquetan, no se instalan—, así que nada avisa: el
servicio compila igual y solo se nota en el tamaño del `output/app.js`.

### Dos trampas al auditar dependencias sin usar

**1. El lanzador no está en el bundle.** `app.js` en la raíz del workspace hace
`require("source-map-support").install()` y, bajo `process.env.DATADOG`, `require("dd-trace").init()`,
las dos cosas **antes** de cargar `./output/app`. Ninguna aparece como `require()` dentro del bundle,
así que auditar grepeando solo `output/app.js` las marca como no usadas — y quitar
`source-map-support` no engorda el bundle: rompe el arranque. Hay que mirar también `app.js` y
`devel.js`.

**2. `tslib` no se puede quitar aunque no aparezca.** Los tsconfig base (`tsconfig/node.json` y
`tsconfig/browser.json`) llevan `importHelpers: true`, así que `tsc` exige poder resolver `tslib` en
cuanto un fichero emite un helper — y `packd` ejecuta `tsc --noEmit` junto a esbuild, de modo que el
build falla entero. En el bundle no aparece porque esbuild inserta sus propios helpers y no respeta
`importHelpers`, lo que hace que parezca prescindible en los workspaces que hoy no emiten ninguno.
Lo es solo hasta que alguien escriba un decorador.

### Cómo comprobar si una dependencia sobra

1. `require()` en `output/app.js` tras `packd`.
2. `require()` en el lanzador `app.js` y en `devel.js`.
3. Requires no literales en el bundle (carga dinámica que esbuild no puede resolver).
4. Tras quitarla: `yarn install`, recompilar y comprobar que `output/app.js` **no crece**. Si crece,
   se usaba y ahora está empaquetada dentro.

El paso 4 es el que cierra el asunto, porque no depende de haber acertado con los tres anteriores.

---

## Reglas de runtime

| Runtime | Entradas | Salida |
|---------|----------|--------|
| `node` + `framework!=nextjs` | `app -> main.ts` | `output/[name].js` |
| `node` + `framework=nextjs` | No soportado por este bundler | Se omite (warning) |
| `browser/cfworker/php` | No soportado por este bundler | Se omite (warning) |

---

## Variables globales inyectadas (`define`)

- `DESARROLLO`
- `TEST`
- `PRODUCCION`
- `ENTORNO`
- `NEXTJS`
- `DATABASE`

Y sus equivalentes en `global.*`.

---

## Uso

```bash
# Compila una única vez (sin --watch, el proceso termina al acabar)
node bundler/esbuild/esbuild.config.mjs --env entorno=desarrollo --env dir="$(pwd)"
```

También admite `--watch` explícito (independiente del `entorno`):

```bash
node bundler/esbuild/esbuild.config.mjs --env entorno=test --env dir="$(pwd)" --watch
```

`dir` se sanea eliminando comillas dobles para compatibilidad con shells que envuelven el valor.
