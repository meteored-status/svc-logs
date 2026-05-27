# `@mr/core-dev` — Bundler rspack

Configuración compartida de **[rspack](https://www.rspack.dev/)** para todos los
workspaces del monorepo.

---

## Estructura de ficheros

```
bundler/rspack/
├── rspack.config.ts   ← Punto de entrada; exporta el array de configuraciones
├── configuracion.ts   ← Ensambla todos los fragmentos en un `Configuration` de rspack
├── devtool.ts         ← Sección `devtool` (source maps)
├── entry.ts           ← Sección `entry` (puntos de entrada)
├── externals.ts       ← Sección `externals` (dependencias no empaquetadas)
├── module.ts          ← Sección `module` (loaders: TypeScript, CSS, SASS, Pug, assets)
├── optimization.ts    ← Sección `optimization` (minificación, splitChunks)
├── output.ts          ← Sección `output` (directorio y nombre de los ficheros generados)
├── plugins.ts         ← Plugins de rspack (DefinePlugin, CssExtract, Manifest, TsChecker)
├── target.ts          ← Sección `target` (node / web+es5)
└── tsconfig.json      ← tsconfig local para compilar esta carpeta
```

---

## Flujo de compilación

```
mrpack.json + package.json
        │
        ▼
rspack.config.ts         Lee manifiesto y dependencias; genera N configuraciones
        │
        ▼
configuracion.ts         Ensambla cada Configuration; activa watch en desarrollo
   ├── entry.ts          app → main.ts (node) | entradas del manifiesto (browser)
   ├── output.ts         output/ (node) | output/bundle/ o output/critical/ (browser)
   ├── devtool.ts        source-map siempre en node; condicional en browser
   ├── module.ts         swc-loader + css-loader + sass-loader + pug3-loader
   ├── optimization.ts   minimize=!desarrollo; vendor chunk en browser
   ├── externals.ts      todas las deps node_modules → external; vacío en browser
   ├── target.ts         "node" | ["web","es5"]
   └── plugins.ts        DefinePlugin + RspackManifestPlugin + TsCheckerRspackPlugin + CssExtract
```

---

## Bundles generados

`rspack.config.ts` devuelve **un array** con:

1. **Bundle principal** — compilado con el `runtime` del `mrpack.json` (normalmente `node`).
2. **Bundles web** — uno por cada elemento de `manifest.build.bundle.web`, siempre con
   `Runtime.browser`.

---

## Entornos

| Variable de entorno `--env entorno` | `desarrollo` | `test` | Descripción |
|-------------------------------------|:------------:|:------:|-------------|
| `"desarrollo"`                      | `true`       | `true` | Watch activado; sin minificación; nombres de chunk sin hash. |
| `"test"`                            | `false`      | `true` | Sin watch; minificación activa; source maps en browser. |
| `"produccion"`                      | `false`      | `false`| Sin watch; minificación; nombres de chunk con `[contenthash]`. |

> **Nota:** `test` es `true` también en `"desarrollo"` para habilitar los source maps
> de CSS/SASS en ese entorno.

---

## Variables globales inyectadas (`DefinePlugin`)

Disponibles en todo el código compilado y en `global.*`:

| Variable    | Tipo      | Valor |
|-------------|-----------|-------|
| `DESARROLLO`| `boolean` | `entorno === "desarrollo"` |
| `TEST`      | `boolean` | `entorno === "test"` |
| `PRODUCCION`| `boolean` | `!desarrollo` |
| `ENTORNO`   | `string`  | Valor literal del entorno |
| `NEXTJS`    | `boolean` | `true` si el framework es Next.js |
| `DATABASE`  | `string \| undefined` | Nombre de la BD para el entorno activo |

---

## Externals (Node)

Todas las dependencias de `package.json` se marcan como externas (`not bundled`).
Las que aparecen en la lista `ES_MODULES` de `externals.ts` y coinciden con la major
declarada se importan como `module`; el resto, como `commonjs`.

Se incluye también una función de externals que resuelve **sub-paths**
(p. ej. `formidable/src/...`) con el mismo tipo que su paquete raíz.

---

## Loaders (`module.ts`)

| Condición | Loader | Descripción |
|-----------|--------|-------------|
| Siempre | `builtin:swc-loader` | Transpila TypeScript con SWC integrado en rspack. Soporta decoradores y `decoratorMetadata`. |
| `componentes.pug = true` | `pug3-loader` | Compila plantillas `.pug`. `pretty: true` en desarrollo. |
| `css ≠ DESACTIVADO` | `css-loader` | Procesa `@import` y `url()` en CSS y SASS. sourceMap en desarrollo/test. |
| `css = INYECTADO` | `style-loader` | Inyecta CSS en el `<head>` del documento. |
| `css ≠ INYECTADO` | `CssExtractRspackPlugin.loader` | Extrae CSS a un fichero separado. |
| `css ≠ DESACTIVADO` | `sass-loader` (`sass-embedded`, API `modern-compiler`) | Compila SCSS/SASS con binario nativo Dart Sass. Salida `compressed` en producción/critical. Instancia compartida entre ficheros para reducir overhead. |
| `css = STRING` | `to-string-loader` | Exporta el CSS como string (útil para Shadow DOM). |
| `css = CRITICAL` | `asset/inline` para imágenes | Incrusta assets como data URL. |
| `css ≠ CRITICAL` | `asset/resource` para imágenes | Copia assets al directorio de salida. |
| `rules.js` existe | loader externo | Reglas adicionales definidas por el workspace. |

---

## Output

| Runtime   | Directorio              | Fichero (desarrollo)  | Fichero (producción)          |
|-----------|-------------------------|-----------------------|-------------------------------|
| `node`    | `<basedir>/output/`     | `[name].js`           | `[name].js`                   |
| `browser` | `<basedir>/output/bundle/` o `output/critical/` | `[name].js` | `[name]/[contenthash].js` |

El `uniqueName` del output es el `basename` del `basedir` (nombre del workspace),
evitando colisiones entre bundles paralelos.

---

## Uso

Este fichero **no se usa directamente** en los workspaces. El CLI del monorepo
lo referencia como configuración de rspack pasando las variables de entorno:

```sh
rspack --config node_modules/@mr/core-dev/bundler/rspack/rspack.config.js \
       --env entorno=produccion \
       --env dir=$(pwd)
```

---

## Dependencias notables

| Paquete | Uso |
|---------|-----|
| `@rspack/core` | Bundler principal |
| `rspack-manifest-plugin` | Genera `stats.json` con las URLs de los assets browser |
| `ts-checker-rspack-plugin` | Comprobación de tipos TypeScript en paralelo al bundle |
| `css-loader` / `sass-loader` | Procesado de CSS y SCSS |
| `pug3-loader` | Plantillas Pug |
| `style-loader` / `to-string-loader` | Estrategias de inyección de CSS |

