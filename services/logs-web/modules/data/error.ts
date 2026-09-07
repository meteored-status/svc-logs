import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import elastic from "services-comun/modules/utiles/elastic";
import {type ILogErrorCtxES, type ILogErrorES, LOG_ERRORES_ALIAS} from "services-comun-status/modules/services/logs/logs/elastic";

import type {Configuracion} from "../utiles/config";
import {SlaveSpec} from "./status";

/**
 * La ingesta de un log de error: qué se acepta por HTTP y qué se indexa.
 *
 * **El documento y el índice salen del framework compartido** (`services/logs/logs/elastic`), que es el mismo
 * sitio del que los lee el panel (`status-backend`, en el repo `svc-status`). Estuvieron declarados aparte en
 * el paquete `logs-services` —las mismas diez propiedades y el mismo `"mr-log-errores"` escritos a mano— y eso
 * es lo único que hacía ese paquete, con este servicio como único consumidor. Dos declaraciones del mismo
 * documento en dos repos es exactamente lo que se acaba separando sin que nadie lo note: quien escribe añade
 * un campo y quien lee no lo sabe.
 */

/**
 * Lo que se acepta en `POST /service/logs/error/`.
 *
 * `linea` es una **cadena** y no un número, que es como la manda quien loguea; el panel la convierte al
 * enseñarla. `ctx` usa el tipo del documento indexado porque son el mismo par de campos y pasan tal cual: no
 * hay conversión que justifique un tipo propio para el cable.
 */
export interface ILogErrorPOST {
    proyecto: string;
    servicio: string;
    url: string;
    mensaje: string;
    archivo: string;
    linea: string;
    traza?: string[];
    ctx?: ILogErrorCtxES[];
}

/**
 * El índice de un proyecto: hay uno por proyecto y el alias los agrupa.
 *
 * En minúsculas porque Elasticsearch no admite mayúsculas en el nombre de un índice, y el proyecto llega tal
 * y como lo escriba quien loguea.
 */
const indiceDe = (proyecto: string): string => `${LOG_ERRORES_ALIAS}-${proyecto.toLowerCase()}`;

/**
 * El documento tal y como se indexa.
 *
 * Las listas vacías se mandan como `undefined` para que no ocupen en el índice: un error sin traza y sin
 * contexto es la mayoría de los casos.
 */
const documento = (data: ILogErrorPOST): ILogErrorES => ({
    "@timestamp": new Date().toISOString(),
    // Nace sin revisar. El «borrado» del panel es ponerlo a `true`, así que esto es lo que hace que un error
    // nuevo aparezca en el listado.
    checked: false,
    proyecto: data.proyecto,
    servicio: data.servicio,
    url: data.url,
    mensaje: data.mensaje,
    archivo: data.archivo,
    linea: data.linea,
    ...data.traza !== undefined && data.traza.length > 0 ? {traza: data.traza} : {},
    ...data.ctx !== undefined && data.ctx.length > 0 ? {ctx: data.ctx} : {},
});

/**
 * El buffer de escritura, uno por proceso: agrupa los documentos y los manda en lotes.
 *
 * Se arranca al cargar el módulo porque su temporizador es lo que vacía el buffer; sin `start()` los
 * documentos se quedarían encolados hasta llenar el lote.
 */
export const BULK = new BulkAuto(elastic);
BULK.start();

/**
 * Encola un log de error. **No espera al índice**: el handler ya ha contestado `200` cuando esto corre, que
 * es lo que se quiere de una ingesta de logs — quien loguea no puede quedarse esperando a Elasticsearch.
 *
 * @param data   El log recibido.
 * @param config La configuración, para el aviso al panel de status si falla la escritura.
 */
export function ingest(data: ILogErrorPOST, config: Configuracion): void {
    BULK.create({
        index: indiceDe(data.proyecto),
        doc: documento(data),
    }).promise.catch(async (err) => {
        const logsSpec = await SlaveSpec.get(config);
        logsSpec.cluster.elastic.current_publish.errors.push({
            error: err.message ?? "Error desconocido"
        });
        logsSpec.cluster.elastic.current_publish.count++;
        logsSpec.cluster.elastic.current_publish.date = Date.now();

        await logsSpec.buildMonitors();
    });
}
