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
5. En watch (por `entorno=desarrollo` o `--watch`) lanza también `tsc --watch`.
6. En `test/produccion` limpia `output/` y compila una vez.

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
node bundler/esbuild/esbuild.config.mjs --env entorno=desarrollo --env dir="$(pwd)"
```

También admite `--watch` explícito:

```bash
node bundler/esbuild/esbuild.config.mjs --env entorno=test --env dir="$(pwd)" --watch
```

`dir` se sanea eliminando comillas dobles para compatibilidad con shells que envuelven el valor.
