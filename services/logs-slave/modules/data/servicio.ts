import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import {type ILogServicio, LogServicio as LogServicioBase} from "logs-base/modules/data/log/servicio";
import elastic from "services-comun/modules/utiles/elastic";

export interface ILogServicioPOST {
    proyecto: string;
    servicio: string;
    tipo: string;
    severidad: string;
    mensaje: string;
    extra?: string[];
}

export class LogServicio extends LogServicioBase {
    /* STATIC */
    public static BULK = new BulkAuto(elastic);
    static {
        this.BULK.start();
    }

    public static ingest(data: ILogServicioPOST): void {
        const documento = new this({
            timestamp: new Date(),
            proyecto: data.proyecto,
            servicio: data.servicio,
            tipo: data.tipo,
            severidad: data.severidad,
            mensaje: data.mensaje,
            extra: data.extra ?? [],
        });

        this.BULK.create({
            index: LogServicio.getIndex(documento.proyecto),
            doc: documento.toJSON(),
        });
    }

    /* INSTANCE */
    public constructor(data: ILogServicio) {
        super(data);
    }
}
