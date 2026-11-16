/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 16:33:45 GMT
 * Hash: 9fab062c9e82702b3a2c7f70a4b1e983
 * Versión: 2026.11.9+15-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {createHash} from "node:crypto";
import path from "node:path";

/**
 * Marca que precede al `buildId` en la salida de {@link PREVER_BUILD_ID}, para no confundirlo con lo
 * que escriba por su cuenta el `next.config` al cargarse.
 */
const MARCA = "@@BUILD_ID@@";

/**
 * Script (`node -e`, desde el directorio del workspace y con su PnP) que calcula el `buildId` que
 * usaría `next build`, sin compilar nada.
 *
 * Carga la configuración con el cargador del propio Next (`next/dist/server/config`), en la fase de
 * build: así vale para `next.config.js`, `.mjs` o `.ts`, y para un `next.config` que sea una función
 * de la fase, igual que en el build. Después llama a su `generateBuildId()`. Si no lo hay, o devuelve
 * algo que no es texto, no escribe nada: Next usaría entonces un id aleatorio que no se puede prever.
 *
 * No carga los `.env` del workspace, que `next build` sí carga antes de la configuración: un
 * `generateBuildId` que dependa de ellos daría otro id, y `packNextJS` lo avisa tras compilar.
 *
 * `next` se resuelve desde el `package.json` del workspace (`createRequire`): con PnP, un `require`
 * a secas desde `-e` no lo encuentra.
 */
export const PREVER_BUILD_ID = [
    `const cargar = require("node:module").createRequire(process.cwd() + "/package.json")("next/dist/server/config").default;`,
    `cargar("phase-production-build", process.cwd(), {silent: true})`,
    `    .then(async (config) => {`,
    `        const id = typeof config.generateBuildId === "function" ? await config.generateBuildId() : null;`,
    `        if (typeof id === "string" && id.trim().length > 0) {`,
    `            process.stdout.write("\\n${MARCA}" + id.trim() + "\\n");`,
    `        }`,
    `    })`,
    `    .catch((e) => { console.error(e); process.exit(1); });`,
].join("\n");

/**
 * Extrae el `buildId` de la salida de {@link PREVER_BUILD_ID}.
 *
 * @param salida - stdout del script.
 * @returns El `buildId`, o `undefined` si el script no lo ha escrito (no hay `generateBuildId`).
 */
export function leerBuildId(salida: string): string|undefined {
    const linea = salida.split(/\r?\n/).reverse().find((actual)=>actual.startsWith(MARCA));
    if (linea===undefined) {
        return undefined;
    }
    const id = linea.substring(MARCA.length).trim();

    return id.length>0 ? id : undefined;
}

/**
 * El mismo valor que `md5Dir()` (`@mr/core-cli/fs`) da para un fichero, pero a partir de un contenido
 * que se conoce sin que el fichero exista todavía. Sirve para calcular el hash del despliegue con el
 * `.next/BUILD_ID` previsto antes de lanzar `next build`.
 *
 * Tiene que seguir **exactamente** a `md5Dir()`: si se separan, el hash previsto no coincide nunca
 * con el de la imagen desplegada y se compila siempre, sin que nada falle. Lo vigilan
 * `spec/workspace/build-id.spec.ts` y `packNextJS`, que tras cada `next build` lo compara con el
 * `md5Dir()` real del `BUILD_ID` y avisa si no coinciden.
 *
 * @param ruta - Ruta del fichero; solo cuenta su nombre.
 * @param contenido - Contenido que tendrá.
 * @returns El hash, como lo daría `md5Dir(ruta)`.
 */
export function md5Fichero(ruta: string, contenido: string): string {
    // `md5` a mano, como el de `@mr/core-cli/fs`, en vez del de `services-comun`: el arnés de pruebas
    // no carga los `.ts` de otros workspaces.
    const md5 = (texto: string): string => createHash("md5").update(texto).digest("hex");

    return md5(`${md5(path.basename(ruta))}${md5(contenido)}`);
}
