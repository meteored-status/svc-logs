/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 21ebbcfeb095b002bc5d744cbc67a24a
 * Versión: 2026.9.23+2-bixus
 * Anterior: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {actualizarTodo} from "./framework";
import {init as initWS} from "./init";
import {aplicarPatches} from "./patches";
import {update} from "./yarn";

/**
 * Inicializa el proyecto, actualiza los frameworks y las dependencias de Yarn.
 * Equivale a ejecutar `init` + `framework --update` + `patch:apply` + `yarn update`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function init(basedir: string): Promise<void> {
    let cambioInit = await initWS(basedir);
    const cambioFramework = await actualizarTodo(basedir, {forzar: true});
    if (cambioFramework) {
        await aplicarPatches(basedir);
        const cambio = await initWS(basedir);
        cambioInit = cambioInit || cambio;
    }
    await update(basedir, cambioInit || cambioFramework);
}
