/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 13:02:13 GMT
 * Hash: 5f895a1ff057f161f5c9641c132c35d3
 * Versión: 2026.11.9+13-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Versión mayor de Node de todo el monorepo: la que usa `fnm` en local, el pipeline para instalar y
 * compilar, y la imagen base de los contenedores. `mrpack init` la escribe en el `.node-version` de la
 * raíz, y el pipeline la lee de allí (`versionNode()` en `deployment/std/aliases.sh`). Un trigger puede
 * sustituirla con `_NODE_VERSION` para probar otra.
 *
 * Antes era `lts-latest`, y cada octubre local, CI y producción saltaban de versión mayor sin avisar,
 * cada uno por su lado (así se rompió el pipeline el 2026-10-29, cuando Node 25 dejó de traer corepack).
 * Subirla es una decisión: cambiar este valor, enviar el framework y ejecutar `mrpack init`. Al cambiar,
 * se regeneran todas las imágenes, porque entra en su hash.
 */
export const NODE_VERSION = "26";
