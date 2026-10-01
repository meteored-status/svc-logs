/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 972115ff086d6663f2d68633a8517c7c
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IComponent} from "services-comun/modules/status/common/interface";

export interface IPostSave {
    components: IComponent[];
}
