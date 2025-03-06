import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import {ILogError, type ILogErrorCTX, LogError as LogErrorBase} from "logs-base/modules/data/log/error";
import elastic from "services-comun/modules/utiles/elastic";

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

export class LogError extends LogErrorBase {
    /* STATIC */
    public static BULK = new BulkAuto(elastic);
    static {
        this.BULK.start();
    }

    public static ingest(data: ILogErrorPOST): void {
        const documento = new this({
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

        this.BULK.create({
            index: this.getIndex(documento.proyecto),
            doc: documento.toJSON(),
        }).promise.catch((err) => {
            console.error("Error al insertar log de error", err);  //TODO pintar en el status
        });
    }

    /* INSTANCE */
    public constructor(data: ILogError) {
        super(data);
    }
}
