import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import elastic from "services-comun/modules/utiles/elastic";
import {type ILogServicioES, LOG_SERVICIOS_ALIAS} from "services-comun-status/modules/services/logs/logs/elastic";

/**
 * La ingesta de un log de servicio: qué se acepta por HTTP y qué se indexa.
 *
 * Mismo criterio que `error.ts` —el documento y el alias salen del framework compartido, que es de donde los
 * lee el panel—, y **sin el aviso al status si falla**: un log de servicio que no entra no dice nada de la
 * salud del sistema, y el que sí lo dice es el de errores.
 */

/** Lo que se acepta en `POST /service/logs/service/`. */
export interface ILogServicioPOST {
    proyecto: string;
    servicio: string;
    tipo: string;
    severidad: string;
    mensaje: string;
    extra?: string[];
}

/** El índice de un proyecto: uno por proyecto, agrupados por el alias. En minúsculas, como el de errores. */
const indiceDe = (proyecto: string): string => `${LOG_SERVICIOS_ALIAS}-${proyecto.toLowerCase()}`;

/** El documento tal y como se indexa. `extra` vacío no viaja, que es el caso habitual. */
const documento = (data: ILogServicioPOST): ILogServicioES => ({
    "@timestamp": new Date().toISOString(),
    proyecto: data.proyecto,
    servicio: data.servicio,
    tipo: data.tipo,
    severidad: data.severidad,
    mensaje: data.mensaje,
    ...data.extra !== undefined && data.extra.length > 0 ? {extra: data.extra} : {},
});

/**
 * El buffer de escritura, **uno y no dos**: el paquete `logs-services` arrancaba otro `BulkAuto` dentro de la
 * clase del documento que nadie usaba para escribir —los `create()` iban todos a este—, así que había un
 * temporizador vaciando una cola siempre vacía. Se ha quedado el que se usa.
 */
export const BULK = new BulkAuto(elastic);
BULK.start();

/**
 * Encola un log de servicio. No espera al índice: el handler ya ha contestado cuando esto corre.
 *
 * @param data El log recibido.
 */
export function ingest(data: ILogServicioPOST): void {
    BULK.create({
        index: indiceDe(data.proyecto),
        doc: documento(data),
    });
}
