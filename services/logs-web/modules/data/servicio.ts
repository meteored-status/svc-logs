import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import elastic from "services-comun/modules/utiles/elastic";
import {Log} from "logs-services/modules/data/servicio";

export interface ILogServicioPOST {
    proyecto: string;
    servicio: string;
    tipo: string;
    severidad: string;
    mensaje: string;
    extra?: string[];
}

export const BULK = new BulkAuto(elastic);
BULK.start();

export function ingest(data: ILogServicioPOST): void {
    const documento = new Log({
        timestamp: new Date(),
        proyecto: data.proyecto,
        servicio: data.servicio,
        tipo: data.tipo,
        severidad: data.severidad,
        mensaje: data.mensaje,
        extra: data.extra ?? [],
    });

    BULK.create({
        index: Log.getIndex(documento.proyecto),
        doc: documento.toJSON(),
    });
}
