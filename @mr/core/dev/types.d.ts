/**
 * Declaraciones de variables globales inyectadas en tiempo de compilación por el bundler
 * (rspack/webpack). Disponibles en cualquier workspace que extienda los tsconfigs de
 * `@mr/core-dev` o tenga `"@mr/core-dev"` en el array `types` de su tsconfig.
 *
 * Todas las variables son **literales inlinados**: el bundler reemplaza cada referencia
 * por su valor concreto antes de emitir el bundle, lo que permite eliminar ramas muertas
 * (tree-shaking) sin overhead en runtime.
 *
 * ### Combinaciones válidas
 *
 * | Entorno | `PRODUCCION` | `TEST` | `DESARROLLO` |
 * |---------|:---:|:---:|:---:|
 * | Producción | `true` | `false` | `false` |
 * | Test/staging | `true` | `true` | `false` |
 * | Desarrollo local | `false` | `false` | `true` |
 */

/**
 * `true` cuando el código se ha compilado en **modo producción**.
 *
 * El modo producción abarca tanto el entorno de producción como el de test/staging:
 * en ambos casos el bundle está optimizado (minificado, sin source maps de desarrollo, etc.).
 * En modo producción, {@link DESARROLLO} siempre es `false`.
 *
 * Para distinguir producción de test dentro del modo producción, usar {@link TEST}.
 */
declare var PRODUCCION: boolean;

/**
 * `true` únicamente en el entorno de **test/staging**.
 *
 * Solo puede ser `true` cuando {@link PRODUCCION} también lo es.
 * Permite diferenciar test de producción dentro del modo producción:
 * - Producción: `PRODUCCION=true`, `TEST=false`
 * - Test:       `PRODUCCION=true`, `TEST=true`
 */
declare var TEST: boolean;

/**
 * `true` cuando el código se ha compilado en **modo desarrollo** (local).
 *
 * En este modo {@link PRODUCCION} y {@link TEST} son siempre `false`.
 * El bundle incluye source maps completos, sin minificación y con hot-reload.
 */
declare var DESARROLLO: boolean;

/**
 * `true` cuando el código se ejecuta dentro de un runtime **Next.js**
 * (p. ej. en un Server Component o en la capa de API de Next).
 */
declare var NEXTJS: boolean;

/**
 * Nombre del entorno activo tal como lo define el bundler.
 * Valores típicos: `"produccion"`, `"test"`, `"desarrollo"`.
 */
declare var ENTORNO: string;

/**
 * Nombre de la base de datos MySQL activa para este workspace.
 * `undefined` cuando el workspace no tiene base de datos configurada
 * en `mrpack.json` (`build.database`).
 */
declare var DATABASE: string | undefined;

