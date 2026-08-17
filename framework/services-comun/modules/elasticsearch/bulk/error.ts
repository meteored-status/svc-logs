/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: 2f5d4a9ae5325272490484486b5f07d9
 * Versión: 2026.8.5+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import {CustomError} from "../../utiles/error";

/** Error de uso de {@link "./base.ts".BulkBase} y subclases (índice no indicado, instancia ya cerrada, etc.). */
export class BulkError extends CustomError {
    public constructor(message: string) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.name = "BulkError"; // en subclases, es importante hacer esto
    }
}
