/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 187925c810c3b90198f0b7e170b19bdb
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Parser} from ".";
import {Respuesta} from "../respuesta";

async function parser(response: Response): Promise<Respuesta<ArrayBuffer>> {
    return new Respuesta<ArrayBuffer>(response, await response.arrayBuffer());
}

export default parser as Parser<ArrayBuffer>;
