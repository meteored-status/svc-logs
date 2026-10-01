/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 538c984da229143994a5854566453ade
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Parser} from ".";
import {Respuesta} from "../respuesta";

async function parser(response: Response): Promise<Respuesta<Buffer>> {
    return new Respuesta<Buffer>(response, Buffer.from(await response.arrayBuffer()));
}

export default parser as Parser<Buffer>;
