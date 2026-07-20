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
