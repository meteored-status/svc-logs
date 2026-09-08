/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 76c79c22f0704cbb903a46ef2f425f1e
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.6.25+5-josantoniojimnez
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
    let cambio_init = await initWS(basedir);
    const cambio_framework = await actualizarTodo(basedir, {forzar: true});
    if (cambio_framework) {
        await aplicarPatches(basedir);
        const cambio = await initWS(basedir);
        cambio_init = cambio_init || cambio;
    }
    await update(basedir, cambio_init || cambio_framework);
}
