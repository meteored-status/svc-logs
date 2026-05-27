/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 2fa327b279d4bbdaa87797d02bed3920
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {actualizarTodo} from "./framework";
import {init as initWS} from "./init";
import {update} from "./yarn";

/**
 * Inicializa el proyecto, actualiza los frameworks y las dependencias de Yarn.
 * Equivale a ejecutar `init` + `framework --update` + `yarn update`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function init(basedir: string): Promise<void> {
    let cambio_init = await initWS(basedir);
    const cambio_framework = await actualizarTodo(basedir, {forzar: true});
    if (cambio_framework) {
        const cambio = await initWS(basedir);
        cambio_init = cambio_init || cambio;
    }
    await update(basedir, cambio_init || cambio_framework);
}
