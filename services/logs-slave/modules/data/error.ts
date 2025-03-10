import {BulkAuto} from "services-comun/modules/elasticsearch/bulk/auto";
import {ILogError, type ILogErrorCTX, LogError as LogErrorBase} from "logs-base/modules/data/log/error";
import elastic from "services-comun/modules/utiles/elastic";
import {LogsSpec} from "logs-status-base/modules/status/status";
import client from "services-comun/modules/status/client/client";
import { TGroup } from "logs-status-base/modules/status/status";
import {Configuracion} from "../utiles/config";
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

export class LogError extends LogErrorBase {
    /* STATIC */
    public static BULK = new BulkAuto(elastic);
    static {
        this.BULK.start();
    }

    public static ingest(data: ILogErrorPOST, config: Configuracion): void {
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

    /* INSTANCE */
    public constructor(data: ILogError) {
        super(data);
    }
}
