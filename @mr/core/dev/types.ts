/**
 * Punto de entrada del módulo `@mr/core-dev/types`.
 *
 * Incluir este módulo amplía el scope global de TypeScript con las variables de entorno
 * definidas en {@link ./types.d.ts} (`PRODUCCION`, `TEST`, `DESARROLLO`, `NEXTJS`,
 * `ENTORNO`, `DATABASE`). No exporta ningún símbolo propio; el efecto es puramente
 * de tipos.
 *
 * En la práctica no es necesario importar este módulo explícitamente: los tsconfigs de
 * `@mr/core-dev` incluyen `@mr/core-dev` en el array `types`, por lo que las variables
 * quedan disponibles de forma automática en cualquier workspace que extienda dichos
 * tsconfigs (directa o transitivamente).
 *
 * Solo es necesario el import explícito en workspaces que no extiendan los tsconfigs
 * de `@mr/core-dev`:
 * ```ts
 * import "@mr/core-dev/types";
 * if (PRODUCCION) { ... }
 * ```
 */
/// <reference path="./types.d.ts" />
export {
    // nah
};
