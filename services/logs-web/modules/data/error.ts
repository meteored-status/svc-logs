import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import elastic from "services-comun/modules/utiles/elastic";

import type {Configuracion} from "../utiles/config";
import {Error, type ILogErrorCTX} from "logs-services/modules/data/error";
import {SlaveSpec} from "./status";

export interface ILogErrorPOST {
    proyecto: string;
    servicio: string;
    url: string;
    mensaje: string;
    archivo: string;
    linea: string;
    traza?: string[];
    ctx?: ILogErrorCTX[];
}

export const BULK = new BulkAuto(elastic);
BULK.start();

export function ingest(data: ILogErrorPOST, config: Configuracion): void {
    const documento = new Error({
        timestamp: new Date(),
        checked: false,
        proyecto: data.proyecto,
        servicio: data.servicio,
        url: data.url,
        mensaje: data.mensaje,
        archivo: data.archivo,
        linea: data.linea,
        traza: data.traza ?? [],
        ctx: data.ctx ?? [],
    });

    BULK.create({
        index: Error.getIndex(documento.proyecto),
        doc: documento.toJSON(),
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
